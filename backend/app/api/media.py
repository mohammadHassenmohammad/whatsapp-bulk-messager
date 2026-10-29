import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/media", tags=["Media"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

def validate_image_magic_bytes(content: bytes, ext: str) -> bool:
    if len(content) < 12:
        return False
    if ext in [".jpg", ".jpeg"]:
        return content.startswith(b"\xff\xd8\xff")
    elif ext == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    elif ext == ".gif":
        return content.startswith(b"GIF87a") or content.startswith(b"GIF89a")
    elif ext == ".webp":
        return content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    return False

@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Please upload JPG, PNG, WebP, or GIF.")
    
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > 15 * 1024 * 1024: # 15MB limit
        raise HTTPException(status_code=400, detail="Image size exceeds 15MB limit")
    
    if not validate_image_magic_bytes(content, ext):
        raise HTTPException(
            status_code=400,
            detail="File content signature does not match the image file extension. Upload rejected."
        )

    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    target_path = os.path.join(UPLOAD_DIR, unique_name)

    # Ensure path stays within UPLOAD_DIR
    real_target = os.path.realpath(target_path)
    real_upload_dir = os.path.realpath(UPLOAD_DIR)
    if not real_target.startswith(real_upload_dir):
        raise HTTPException(status_code=400, detail="Invalid target filename path")

    with open(target_path, "wb") as f:
        f.write(content)

    file_url = f"http://127.0.0.1:8090/uploads/{unique_name}"
    return {
        "success": True,
        "filename": unique_name,
        "url": file_url,
        "size": len(content)
    }
