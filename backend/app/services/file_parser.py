"""
File Parser Service — extract plain text from PDF and DOCX files.
"""

from fastapi import UploadFile, HTTPException


async def parse_cv_file(file: UploadFile) -> str:
    """Accept PDF or DOCX upload, return extracted plain text."""
    content = await file.read()
    filename = file.filename or ""

    if filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
        return _parse_pdf(content)
    elif filename.lower().endswith((".docx", ".doc")) or file.content_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return _parse_docx(content)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a PDF or DOCX file.",
        )


async def parse_interview_file(file: UploadFile) -> str:
    """Accept DOCX or plain text file, return extracted text."""
    content = await file.read()
    filename = file.filename or ""

    if filename.lower().endswith((".docx", ".doc")) or file.content_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return _parse_docx(content)
    elif file.content_type and file.content_type.startswith("text/"):
        return content.decode("utf-8", errors="replace")
    elif filename.lower().endswith(".txt"):
        return content.decode("utf-8", errors="replace")
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a DOCX or TXT file.",
        )


def _parse_pdf(content: bytes) -> str:
    """Extract text from PDF bytes using PyPDF2."""
    try:
        import io
        from PyPDF2 import PdfReader

        reader = PdfReader(io.BytesIO(content))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
        result = "\n\n".join(pages)
        if not result.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from PDF. The file may be scanned or image-based.",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {e}")


def _parse_docx(content: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    try:
        import io
        from docx import Document

        doc = Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        result = "\n".join(paragraphs)
        if not result.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from DOCX. The document may be empty.",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse DOCX: {e}")
