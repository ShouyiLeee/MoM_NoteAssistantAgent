# 🐛 MoM_NoteAssistantAgent — Bug Report & Fix Plan

> **Reviewed:** 2026-03-21  
> **Scope:** Full-stack code review (backend + frontend)

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical (data corruption / crash) | 3 |
| 🟠 High (incorrect behavior) | 5 |
| 🟡 Medium (potential issues) | 4 |
| 🔵 Low (minor / code quality) | 3 |

---

## 🔴 Critical Bugs

### BUG-01: Pass Rate hiển thị sai — nhân đôi giá trị (x100 hai lần)

**File:** [analytics.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/api/analytics.py#L35) + [index.tsx](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/frontend/src/pages/index.tsx#L191)

**Mô tả:** Backend đã tính `pass_rate` ở dạng **phần trăm** (ví dụ `66.7`), nhưng frontend lại nhân thêm `* 100` khi hiển thị. Kết quả: pass rate 66.7% sẽ hiện thành **6670%**.

```python
# Backend (analytics.py L35) — đã nhân 100
pass_rate = round(pass_count / total * 100, 1) if total > 0 else 0.0
```
```tsx
// Frontend (index.tsx L191, L230) — nhân thêm 100 lần nữa
value={`${((data?.pass_rate ?? 0) * 100).toFixed(0)}%`}
```

**Fix:** Bỏ `* 100` ở frontend, hiển thị trực tiếp `data.pass_rate`:
```diff
- value={`${((data?.pass_rate ?? 0) * 100).toFixed(0)}%`}
+ value={`${(data?.pass_rate ?? 0).toFixed(1)}%`}
```

---

### BUG-02: Frontend `AnalyticsResponse` type không khớp với Backend

**File:** [api.ts](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/frontend/src/lib/api.ts#L74-L82)

**Mô tả:** Frontend type definitions khác hoàn toàn so với dữ liệu backend trả về, dẫn đến **crash khi render charts**:

| Field | Frontend type | Backend actual |
|-------|-------------|---------------|
| `by_stage` | `Record<string, number>` | `Record<string, {total, pass, fail, pending}>` |
| `by_company` | `Array<{company, count}>` | `Record<string, {total, pass, fail, pending}>` |

**Hệ quả:**
- `Object.values(data.by_stage)` trả về objects thay vì numbers → Bar chart nhận `[Object]` thay vì `[5]`
- `data.by_company.map(c => c.company)` crash vì `by_company` là Object, không phải Array

**Fix:** Sửa frontend type hoặc transform data sau khi fetch:
```typescript
export interface AnalyticsResponse {
  total: number;
  pass_rate: number;
  by_result: Record<string, number>;
  by_stage: Record<string, { total: number; pass: number; fail: number; pending: number }>;
  by_company: Record<string, { total: number; pass: number; fail: number; pending: number }>;
  timeline: Array<{ month: string; count: number }>;
  weakest_stage?: string;
}
```
Đồng thời cập nhật logic render chart trong `index.tsx` để extract `.total` từ by_stage và by_company.

---

### BUG-03: CV Upload gửi sai field name → Backend reject 422

**File:** [api.ts](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/frontend/src/lib/api.ts#L127-L134)

**Mô tả:** Frontend gửi `raw_text` và `original_filename`, nhưng backend schema `CVUploadRequest` yêu cầu `cv_text` và `filename`.

```typescript
// Frontend gửi:
{ user_id: userId, raw_text: rawText, original_filename: filename || null }
```
```python
# Backend schema expects:
class CVUploadRequest(BaseModel):
    user_id: str
    cv_text: str       # ← khác "raw_text"
    filename: str      # ← khác "original_filename"
```

**Fix:**
```diff
- { user_id: userId, raw_text: rawText, original_filename: filename || null }
+ { user_id: userId, cv_text: rawText, filename: filename || null }
```

---

## 🟠 High Severity Bugs

### BUG-04: `CVResponse` thiếu field `is_active`, thừa field `is_new_version`

**File:** [api.ts](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/frontend/src/lib/api.ts#L60-L72) vs [interview.py (schemas)](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/schemas/interview.py#L90-L101)

**Mô tả:**
- Frontend type có `is_new_version: boolean` nhưng backend `CVResponse` schema **không trả** field này
- Backend trả `is_active: bool` nhưng frontend type **không có** field này
- Frontend `cv.tsx` L113-117 sử dụng `res.is_new_version` để hiện toast → luôn `undefined` → fallback logic sai

**Fix:** Bỏ `is_new_version` khỏi frontend type, thêm `is_active`, hoặc thêm logic xác định `is_new_version` ở backend.

---

### BUG-05: `CVResponse` frontend khai báo `skills` và `recent_roles` là `string`, nhưng backend trả `list[str]`

**File:** [api.ts](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/frontend/src/lib/api.ts#L65-L68)

**Mô tả:** Backend schema (`CVResponse` Pydantic) trả `skills: list[str]` và `recent_roles: list[str]`, nhưng frontend type khai báo chúng là `string`. Kết quả: `cv.tsx` L8-22 phải `JSON.parse` lại — logic dư thừa và dễ lỗi nếu backend trả array thực sự.

**Fix:** Sửa frontend type:
```diff
- skills?: string;
- recent_roles?: string;
+ skills: string[];
+ recent_roles: string[];
```

---

### BUG-06: Docker Compose Postgres port không khớp với `.env` default

**File:** [docker-compose.yml](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/docker-compose.yml#L12) vs [config.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/config.py#L11)

**Mô tả:** Docker Compose map Postgres port là `5433:5432` (host port 5433), nhưng default `DATABASE_URL` trong cả `config.py` và `.env.example` sử dụng port `5432`. Nếu dùng Docker Compose → backend **không kết nối được** đến PostgreSQL vì port sai.

**Fix:** Đồng bộ port:
```diff
# Option A: Sửa docker-compose.yml
- "5433:5432"
+ "5432:5432"

# Option B: Sửa .env.example và config.py
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/interview_agent
+ DATABASE_URL=postgresql://postgres:postgres@localhost:5433/interview_agent
```

---

### BUG-07: LLM JSON parsing không có error handling → Crash server khi LLM trả response không hợp lệ

**File:** [llm.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/services/llm.py#L29-L46)

**Mô tả:** `generate_json()` gọi `_parse_json()` mà không bắt `json.JSONDecodeError`. Nếu LLM trả text không phải JSON hợp lệ (thường xảy ra), server crash với unhandled exception → API trả 500 Internal Server Error không rõ nguyên nhân.

**Fix:** Thêm try/except với retry hoặc error message rõ ràng:
```python
async def generate_json(self, prompt: str, system: str | None = None) -> dict:
    json_prompt = f"{prompt}\n\nRespond ONLY with valid JSON. No markdown, no explanation."
    raw = await self.generate(json_prompt, system)
    try:
        return _parse_json(raw)
    except json.JSONDecodeError as e:
        # Retry once or raise a clear error
        raise ValueError(f"LLM returned invalid JSON: {raw[:200]}") from e
```

---

### BUG-08: Vector dimension mismatch — Comment nói 3072 nhưng `text-embedding-004` trả 768

**File:** [qdrant_client.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/db/qdrant_client.py#L13-L14)

**Mô tả:** Comment ghi `gemini-embedding-001 produces 3072-dimensional vectors` và `VECTOR_SIZE = 3072`, nhưng config sử dụng model `text-embedding-004` (768 dimensions). Nếu collection tạo với size 3072 mà embedding chỉ 768 → **Qdrant reject mọi upsert/search**.

> [!CAUTION]
> Bug này sẽ khiến **toàn bộ pipeline RAG + Note Agent** không hoạt động được. Đây là bug nghiêm trọng nhất nếu chưa từng fix.

**Fix:** Xác nhận model thực tế và sửa `VECTOR_SIZE`:
```diff
- # gemini-embedding-001 produces 3072-dimensional vectors
- VECTOR_SIZE = 3072
+ # text-embedding-004 produces 768-dimensional vectors
+ VECTOR_SIZE = 768
```

---

## 🟡 Medium Severity Bugs

### BUG-09: `note_agent.py` comment step numbering sai

**File:** [note_agent.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/agents/note_agent.py#L52-L58)

**Mô tả:** Comment step 2 bị lặp (có 2 đoạn `# ── 2.`), step 3 thì label là `# ── 3.` nhưng thực tế là step 4. Gây confusing khi maintain.

---

### BUG-10: `weakest_stage` logic sai khi tất cả stages đều 0 fail

**File:** [analytics.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/api/analytics.py#L91-L93)

**Mô tả:** Khi tất cả các stage đều có `fail=0`, `max()` vẫn trả về stage đầu tiên → hiển thị sai "weakest stage" khi không có failure nào.

**Fix:**
```python
fail_stage = None
if by_stage:
    max_fail = max(by_stage.items(), key=lambda x: x[1].get("fail", 0))
    if max_fail[1].get("fail", 0) > 0:
        fail_stage = max_fail[0]
```

---

### BUG-11: `embed_batch` không hỗ trợ batch API — gọi sequential rất chậm

**File:** [embeddings.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/services/embeddings.py#L23-L29)

**Mô tả:** `embed_batch()` gọi `embed()` từng text một trong vòng lặp. Với note dài (nhiều chunks), mỗi API call mất ~200-500ms → upload rất chậm. Nên dùng batch API của Gemini hoặc `asyncio.gather`.

---

### BUG-12: `_chunk_text` trả empty text nếu input toàn whitespace

**File:** [note_agent.py](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/app/agents/note_agent.py#L120-L131)

**Mô tả:** Nếu `text = "   "`, `words = text.split()` trả `[]`, và hàm return `[text]` (chuỗi toàn whitespace). Chunk này sẽ được embed và lưu vào Qdrant — lãng phí storage và gây noise cho RAG.

---

## 🔵 Low Severity

### BUG-13: History page nuốt error — `catch(() => {})`

**File:** [history.tsx](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/frontend/src/pages/history.tsx#L62)

**Mô tả:** Nếu backend bị lỗi, user không thấy thông báo gì → trải nghiệm kém.

---

### BUG-14: `_app.tsx` không import global styles đúng cách

**File:** [_app.tsx](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/frontend/src/pages/_app.tsx)

**Mô tả nhỏ:** File chỉ 187 bytes, cần xác nhận có import `globals.css` hay không (ảnh hưởng toàn bộ styling).

---

### BUG-15: Tests trống — chỉ có `__init__.py` và fixture file

**File:** [tests/](file:///d:/IT/GITHUB/MoM_NoteAssistantAgent/backend/tests)

**Mô tả:** Thư mục tests chỉ chứa `__init__.py` và `fixtures/sample_note.txt`, không có test case nào → không thể CI/CD.

---

## 📋 Fix Priority Plan

| Priority | Bug ID | Effort | Description |
|----------|--------|--------|-------------|
| 1️⃣ | BUG-08 | 5 min | Sửa `VECTOR_SIZE` → 768 (chặn toàn bộ RAG) |
| 2️⃣ | BUG-03 | 2 min | Sửa field name CV upload |
| 3️⃣ | BUG-01 | 2 min | Bỏ `* 100` ở frontend pass_rate |
| 4️⃣ | BUG-02 | 15 min | Sửa `AnalyticsResponse` type + chart render logic |
| 5️⃣ | BUG-06 | 2 min | Đồng bộ Docker port |
| 6️⃣ | BUG-07 | 10 min | Thêm error handling cho LLM JSON |
| 7️⃣ | BUG-04 | 5 min | Sửa `CVResponse` type |
| 8️⃣ | BUG-05 | 5 min | Sửa skills/recent_roles type |
| 9️⃣ | BUG-10 | 5 min | Fix weakest_stage khi 0 fail |
| 🔟 | BUG-09,12,13,14,15 | varies | Medium/Low priority fixes |

> **Estimated total fix time: ~1-2 hours**
