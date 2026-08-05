/** AI 算力基础设施清单（数据中心 / 超算 / 集群）—— 静态参考数据 */

export interface AIInfra {
  id: string
  name: string
  nameZh: string
  location: string
  locationZh: string
  type: 'datacenter' | 'supercomputer' | 'cluster'
  operator: string
  gpuCount: number
  powerMW: number
  status: 'operational' | 'building' | 'planned'
}

export const AI_INFRA: AIInfra[] = [
  { id: 'i1', name: 'Microsoft AI Supercomputer', nameZh: '微软 AI 超算', location: 'Des Moines, Iowa, US', locationZh: '爱荷华州, 美国', type: 'supercomputer', operator: 'Microsoft', gpuCount: 500000, powerMW: 600, status: 'operational' },
  { id: 'i2', name: 'Meta AI Research Cluster', nameZh: 'Meta AI 研究集群', location: 'Santa Clara, CA, US', locationZh: '圣克拉拉, 美国', type: 'cluster', operator: 'Meta', gpuCount: 350000, powerMW: 400, status: 'operational' },
  { id: 'i3', name: 'Tencent Cloud AI Hub', nameZh: '腾讯云 AI 中心', location: 'Guangdong, China', locationZh: '广东, 中国', type: 'datacenter', operator: 'Tencent', gpuCount: 200000, powerMW: 250, status: 'operational' },
  { id: 'i4', name: 'Alibaba AI Compute Zone', nameZh: '阿里 AI 计算区', location: 'Zhangbei, Hebei, China', locationZh: '张北, 河北', type: 'datacenter', operator: 'Alibaba Cloud', gpuCount: 180000, powerMW: 220, status: 'building' },
  { id: 'i5', name: 'Google TPU v7 Pod', nameZh: 'Google TPU v7 集群', location: 'Mayes County, OK, US', locationZh: '梅斯县, 美国', type: 'cluster', operator: 'Google', gpuCount: 600000, powerMW: 700, status: 'building' },
  { id: 'i6', name: 'ByteDance AI Campus', nameZh: '字节跳动 AI 园区', location: 'Beijing, China', locationZh: '北京, 中国', type: 'datacenter', operator: 'ByteDance', gpuCount: 150000, powerMW: 180, status: 'planned' },
]
