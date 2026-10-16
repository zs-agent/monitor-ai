"""Canonical V2 wire contracts. Exported to TypeScript by scripts/export_contracts.py."""
from enum import Enum
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, AliasChoices, StrictBool, StrictStr


class TaskType(str, Enum):
    FACT = "fact_check"
    COMPARISON = "object_comparison"
    DYNAMIC = "dynamic_analysis"
    RISK = "risk_assessment"


class AgentRole(str, Enum):
    PLANNER = "planner"
    RESEARCHER = "researcher"
    VERIFIER = "verifier"
    INTEGRATOR = "integrator"


class ActionPackage(str, Enum):
    DEFER = "defer"
    RESEARCH = "research"
    VERIFY = "research_and_verify"


class VerificationStatus(str, Enum):
    SUPPORTED = "supported"
    CONTRADICTED = "contradicted"
    INSUFFICIENT = "insufficient"
    PENDING = "pending_verification"


class UpdateStatus(str, Enum):
    RETAINED = "retained"
    REVISED = "revised"
    PENDING = "pending"


class RunStatus(str, Enum):
    RUNNING = "running"
    DONE = "done"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


class QuestionStatus(str, Enum):
    PENDING = 'pending'
    DRAFT = 'draft'
    REVIEWED = 'reviewed'
    CARRIED = 'carried'
    UNRESOLVED = 'unresolved'


class SchedulerConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    alpha: float = Field(default=4, ge=0, le=1000)
    beta_verify: float = Field(default=2, ge=0, le=1000)
    beta_risk: float = Field(default=1, ge=0, le=1000)
    w0: float = Field(default=1, ge=0, le=1000)
    wn: float = Field(default=1, ge=0, le=1000)
    wu: float = Field(default=1, ge=0, le=1000)
    wc: float = Field(default=1, ge=0, le=1000)
    ablations: list[Literal["drop_n", "drop_u", "drop_c", "drop_t", "equal_utility"]] = Field(default_factory=list, max_length=5)
    max_feedback_rounds: int = Field(default=1, ge=0, le=8, strict=True)


class QuestionSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str | None = Field(default=None, pattern=r'^[A-Za-z0-9_-]{1,64}$')
    axis: Literal["identity", "capability", "deployment", "ecosystem", "risk"]
    question: str = Field(min_length=1, max_length=500)
    task_type: TaskType


class ManualAssociation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    evidence_key: str = Field(min_length=1, max_length=2048)
    object_name: str = Field(min_length=1, max_length=500)
    question_ids: list[str] = Field(max_length=20)
    reason: str = Field(min_length=1, max_length=1000)


class HumanReview(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)
    question_id: str
    claim_id: str
    reviewer: str = Field(min_length=1, max_length=100)
    verdict: Literal["supported", "contradicted", "insufficient"]
    score: int = Field(ge=0, le=5, strict=True)
    notes: str = Field(default="", max_length=2000)
    resolution: str = Field(default="", max_length=2000)


class ComparisonFields(BaseModel):
    dimension: StrictStr = Field(max_length=500)
    conditions: StrictStr = Field(max_length=2000)
    comparable: StrictBool
    mismatch_reason: StrictStr = Field(default='', max_length=1000)


class VersionFields(BaseModel):
    before: StrictStr = Field(max_length=200)
    after: StrictStr = Field(max_length=200)
    before_time: StrictStr = Field(max_length=100)
    after_time: StrictStr = Field(max_length=100)


class CounterEvidence(BaseModel):
    text: StrictStr = Field(min_length=1, max_length=2000)
    evidence_keys: list[StrictStr] = Field(max_length=16)


class ConclusionPayload(BaseModel):
    """The model boundary is strict about shapes, including optional metadata."""
    text: StrictStr = Field(min_length=1, max_length=2000)
    kind: Literal['fact_statement', 'comparison_judgment', 'trend_inference'] = 'fact_statement'
    evidence_keys: list[StrictStr] = Field(default_factory=list, max_length=16, validation_alias=AliasChoices('evidence_keys', 'source_urls'))
    conditions: StrictStr = Field(default='', max_length=2000)
    uncertainty: StrictStr = Field(default='尚需核查', max_length=1000)
    comparison: ComparisonFields | None = None
    versions: VersionFields | None = None
    counter_evidence: list[CounterEvidence] | None = Field(default=None, max_length=16)


class StructuredConclusion(ConclusionPayload):
    id: str
    status: VerificationStatus
    verification_status: VerificationStatus
    update_status: UpdateStatus
    evidence_fingerprints: dict[str, str]
    source_times: dict[str, str]
    rejected_sources: list[str]
    contract_errors: list[str]


class ReviewCheck(BaseModel):
    index: int = Field(ge=0, le=11, strict=True)
    verdict: Literal['supported', 'contradicted', 'insufficient']
    reason: StrictStr = Field(default='', max_length=2000)


DOMAIN_CONTRACT = {
    "fact_check": "区分事实陈述与推断；保留实际来源键、资料时间和适用条件。",
    "object_comparison": "comparison须含dimension、conditions、comparable(bool)、mismatch_reason。测试条件不一致时不得给出直接优劣排名，须说明不可比原因。",
    "dynamic_analysis": "versions须含before、after、before_time、after_time，记录前后版本及ISO时间。",
    "risk_assessment": "counter_evidence须为反例证据条目数组（每项含text及evidence_keys），uncertainty须说明判断不确定性；未发现反例也须显式记录检索范围及限制。",
}
