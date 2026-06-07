
// Function to verify magic bytes of a file
export async function verifyMagicBytes(bytes: Uint8Array, mimeType: string, fileName: string): Promise<boolean> {
    const fileLower = fileName.toLowerCase();

    // PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
    const isPngBytes = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    // JPEG Magic Bytes: FF D8 FF
    const isJpegBytes = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    // PDF Magic Bytes: %PDF -> 25 50 44 46
    const isPdfBytes = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    // ZIP Magic Bytes: PK\x03\x04 -> 50 4B 03 04
    const isZipBytes = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
    // RAR Magic Bytes: Rar!\x1a\x07 -> 52 61 72 21 1a 07
    const isRarBytes = bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21;
    // 7Z Magic Bytes: 37 7A BC AF 27 1C -> 37 7A BC AF
    const is7zBytes = bytes[0] === 0x37 && bytes[1] === 0x7A && bytes[2] === 0xBC && bytes[3] === 0xAF;

    const isImageMime = mimeType.startsWith('image/');
    const isPdfMime = mimeType === 'application/pdf' || fileLower.endsWith('.pdf');
    const isArchive = mimeType.includes('zip') || mimeType.includes('rar') ||
        fileLower.endsWith('.zip') || fileLower.endsWith('.rar') || fileLower.endsWith('.7z');

    if (isImageMime) {
        if (mimeType.includes('png') && !isPngBytes) return false;
        if ((mimeType.includes('jpeg') || mimeType.includes('jpg')) && !isJpegBytes) return false;
    }
    if (isPdfMime && !isPdfBytes) {
        return false;
    }
    if (isArchive) {
        if (fileLower.endsWith('.zip') && !isZipBytes) return false;
        if (fileLower.endsWith('.rar') && !isRarBytes) return false;
        if (fileLower.endsWith('.7z') && !is7zBytes) return false;
    }

    return true;
}
