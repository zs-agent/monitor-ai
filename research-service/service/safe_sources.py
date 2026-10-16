"""Public source fetching with pinned IPs, including local proxy Fake-IP DNS."""
import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit, urljoin

import aiohttp
from aiohttp.abc import AbstractResolver
import httpx

_FAKE_IP = ipaddress.ip_network('198.18.0.0/15')
_MAX_BYTES = 10 * 1024 * 1024


class SourceAccessError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _public(address):
    ip = ipaddress.ip_address(address)
    return ip.is_global and not (ip.is_multicast or ip.is_reserved or ip.is_unspecified)


async def _https_addresses(host):
    # Fixed public endpoint avoids bootstrapping DoH through the Fake-IP DNS.
    # A records only here; the connector pins these IPv4 addresses and keeps
    # the original hostname for TLS certificate verification and the Host header.
    async with httpx.AsyncClient(timeout=8, follow_redirects=False, trust_env=False) as client:
        response = await client.get('https://1.1.1.1/dns-query',
                                    params={'name': host, 'type': 'A'},
                                    headers={'accept': 'application/dns-json'})
        response.raise_for_status()
    if len(response.content) > 65536:
        raise ValueError('oversized DNS response')
    data = response.json()
    if not isinstance(data, dict) or data.get('Status') != 0:
        raise ValueError('DNS lookup unsuccessful')
    questions = data.get('Question') or []
    if not any(isinstance(q, dict) and q.get('name', '').rstrip('.').lower() == host.rstrip('.').lower() and q.get('type') == 1 for q in questions):
        raise ValueError('DNS response question mismatch')
    return [row['data'] for row in data.get('Answer', []) if isinstance(row, dict) and row.get('type') == 1]


async def resolve_public_url(value):
    try:
        parts = urlsplit(value)
        host = parts.hostname
        if parts.scheme not in ('http', 'https') or not host or parts.username is not None or parts.password is not None or '\\' in parts.netloc:
            raise ValueError('invalid URL')
        if parts.port not in (None, 80, 443):
            raise ValueError('invalid port')
        try:
            literal = ipaddress.ip_address(host)
        except ValueError:
            literal = None
        if literal is not None:
            if not _public(host):
                raise SourceAccessError('source_blocked', '来源地址不是可访问的公网地址')
            return [host]
        info = await asyncio.wait_for(asyncio.to_thread(socket.getaddrinfo, host, None), 5)
        addresses = sorted({row[4][0] for row in info})
        if addresses and all(_public(ip) for ip in addresses):
            return addresses
        # Only an all-Fake-IP answer can trigger external verification.
        # Mixed, private, link-local and loopback answers are never bypassed.
        if addresses and all(ipaddress.ip_address(ip) in _FAKE_IP for ip in addresses):
            try:
                addresses = await _https_addresses(host.encode('idna').decode('ascii'))
            except (httpx.HTTPError, ValueError, OSError, TimeoutError) as exc:
                raise SourceAccessError('proxy_dns_failed', '代理DNS返回虚拟地址，真实公网DNS校验失败，请检查网络连接') from exc
            if addresses and all(_public(ip) for ip in addresses):
                return list(dict.fromkeys(addresses))
        raise SourceAccessError('source_blocked', '来源未通过公网地址校验')
    except SourceAccessError:
        raise
    except (ValueError, OSError, TimeoutError) as exc:
        raise SourceAccessError('source_dns_failed', '来源URL无效或DNS解析失败') from exc


async def public_url(value):
    try:
        await resolve_public_url(value)
        return True
    except SourceAccessError:
        return False


class _PinnedResolver(AbstractResolver):
    def __init__(self, hostname, addresses):
        self.hostname = hostname.rstrip('.').lower()
        self.addresses = addresses

    async def resolve(self, host, port=0, family=socket.AF_INET):
        if host.rstrip('.').lower() != self.hostname:
            raise OSError('unexpected host in pinned connection')
        return [dict(hostname=host, host=ip, port=port, family=socket.AF_INET6 if ':' in ip else socket.AF_INET,
                     proto=0, flags=socket.AI_NUMERICHOST) for ip in self.addresses]

    async def close(self):
        pass


async def _download_once(url, addresses):
    host = urlsplit(url).hostname.encode('idna').decode('ascii')
    connector = aiohttp.TCPConnector(resolver=_PinnedResolver(host, addresses), use_dns_cache=False)
    async with aiohttp.ClientSession(connector=connector, trust_env=False,
                                    timeout=aiohttp.ClientTimeout(total=20, connect=8)) as client:
        async with client.get(url, allow_redirects=False, headers={'User-Agent': 'monitor-ai-research/0.4'}) as response:
            headers = dict(response.headers)
            if response.status in (301, 302, 303, 307, 308):
                return response.status, headers, b''
            if response.status >= 400:
                raise SourceAccessError('source_http_error', f'来源网页返回HTTP {response.status}')
            content = bytearray()
            async for chunk in response.content.iter_chunked(65536):
                content.extend(chunk)
                if len(content) > _MAX_BYTES:
                    raise SourceAccessError('source_too_large', '来源网页超过10MB抓取上限')
            return response.status, headers, bytes(content)


def _parse_source(url, headers, body):
    # Reuse the upstream parsers, supplying an already validated download so
    # they cannot re-resolve the hostname or follow unchecked redirects.
    import requests
    from gpt_researcher.scraper.beautiful_soup.beautiful_soup import BeautifulSoupScraper
    from gpt_researcher.scraper.pymupdf.pymupdf import PyMuPDFScraper
    from gpt_researcher.scraper.scraper import _looks_like_block_page, _looks_like_word_list, _looks_like_unextracted_pdf
    response = requests.Response()
    response.status_code = 200
    response.url = url
    response.headers.update(headers)
    response._content = body
    response._content_consumed = True
    response.encoding = requests.utils.get_encoding_from_headers(response.headers)

    class DownloadedSession:
        def get(self, requested, **kwargs):
            if requested != url:
                raise ValueError('parser attempted an unapproved download')
            return response

    parser = PyMuPDFScraper if body.startswith(b'%PDF-') else BeautifulSoupScraper
    content, _, title = parser(url, DownloadedSession()).scrape()
    if not content or len(content.strip()) < 100 or _looks_like_block_page(content) or _looks_like_word_list(content) or _looks_like_unextracted_pdf(content):
        raise SourceAccessError('source_no_text', '来源未取得可用正文，可能需要登录或仅支持动态页面')
    return content, title


async def fetch_source(url):
    current = url
    for _ in range(6):
        addresses = await resolve_public_url(current)
        status, headers, body = await _download_once(current, addresses)
        if status in (301, 302, 303, 307, 308):
            location = next((v for k, v in headers.items() if k.lower() == 'location'), '')
            if not location:
                raise SourceAccessError('source_redirect_failed', '来源重定向缺少目标地址')
            current = urljoin(current, location)
            continue  # Resolve and validate the target before any connection.
        content, title = await asyncio.to_thread(_parse_source, current, headers, body)
        return dict(url=url, raw_content=content, title=title, final_url=current)
    raise SourceAccessError('source_redirect_failed', '来源重定向次数过多')
