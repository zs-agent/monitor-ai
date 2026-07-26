# kilo.json Provider 配置修复计划

## 当前状态

`kilo.json` 只有 `anthropic` provider，包含 `claude-opus-5` 模型，通过 `https://4sapi.com/v1` 代理。

## 目标

在 `kilo.json` 中新增 `openai` provider，添加 `deepseek-pro` 和 `flash` 两个模型，使用不同的 API key。

## 配置变更

在 `provider` 对象中新增 `openai` 条目：

```jsonc
{
  "$schema": "https://app.kilo.ai/config.json",
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "sk-ZVENx1zh3FQVAJeTM6xzLCYfzqslykV0ytUTUE8GgEVxe9e5",
        "baseURL": "https://4sapi.com/v1",
        "timeout": 300000
      },
      "models": {
        "claude-opus-5": {
          "name": "Claude Opus 5"
        }
      }
    },
    "openai": {
      "options": {
        "apiKey": "sk-vKiQzp1OssHflMHKBLnmsqxXsJlsOeNaZdJ3ItOWmpCgDsf3",
        "baseURL": "https://4sapi.com/v1",
        "timeout": 300000
      },
      "models": {
        "deepseek-pro": {
          "name": "DeepSeek Pro"
        },
        "flash": {
          "name": "Flash"
        }
      }
    }
  }
}
```

## 验证

1. 保存后运行 `/models` 查看是否能看到 `openai/deepseek-pro` 和 `openai/flash`
2. 分别切换模型测试是否能正常调用