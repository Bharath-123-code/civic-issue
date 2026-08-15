import io
import logging
from typing import Tuple

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

# Safety guard against decompression bomb attacks
Image.MAX_IMAGE_PIXELS = 25_000_000

MAX_THUMBNAIL_SIZE: Tuple[int, int] = (800, 800)
JPEG_QUALITY: int = 85


def create_thumbnail(image_bytes: bytes) -> bytes:
    """
    Safely processes and creates a compressed JPEG thumbnail from raw image bytes.
    Maintains the original aspect ratio up to a maximum boundary of 800x800.

    Args:
        image_bytes: Raw binary bytes of the input image.

    Returns:
        bytes: Processed JPEG thumbnail image as bytes.

    Raises:
        ValueError: If input is empty, unsupported, or corrupted.
    """
    if not image_bytes:
        raise ValueError("Image bytes cannot be empty.")

    try:
        input_stream = io.BytesIO(image_bytes)
        img = Image.open(input_stream)
        # Force loading image pixels into memory to validate integrity
        img.load()
    except Exception as exc:
        raise ValueError(f"Invalid or corrupt image data: {exc}") from exc

    try:
        # Correct orientation based on EXIF tag if present
        img = ImageOps.exif_transpose(img)
    except Exception:
        # If EXIF processing fails, proceed with original orientation
        pass

    try:
        # Convert color modes cleanly to RGB for JPEG compatibility
        if img.mode in ("RGBA", "LA"):
            # Blend transparent layers onto a crisp white background
            background = Image.new("RGB", img.size, (255, 255, 255))
            alpha_channel = img.split()[-1]
            background.paste(img, mask=alpha_channel)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize while preserving aspect ratio
        img.thumbnail(MAX_THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

        # Export to in-memory compressed JPEG
        output_stream = io.BytesIO()
        img.save(
            output_stream,
            format="JPEG",
            quality=JPEG_QUALITY,
            optimize=True,
        )
        return output_stream.getvalue()
    except Exception as exc:
        raise ValueError(f"Failed to process image thumbnail: {exc}") from exc

