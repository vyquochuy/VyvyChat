import { Env } from './types/env'
import { verifyMagicBytes } from './utils/verifyMagicBytes'

/**
 * Cloudflare Queue Consumer for processing asynchronous virus scanning
 * and checking Magic Bytes on uploaded file attachments.
 */
export async function queueConsumer(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
  for (const message of batch.messages) {
    try {
      const { attachmentId, storageKey, r2Key, fileName, mimeType, conversationId } = message.body;
      const key = storageKey || r2Key;
      console.log(`[Queue Scanner] Bắt đầu quét file: ${fileName} (${attachmentId})`);
      
      let scanStatus = 'CLEAN';

      // 1. Kiểm tra từ khóa tên file độc hại
      const nameLower = fileName.toLowerCase();
      if (nameLower.includes('infected') || nameLower.includes('virus') || nameLower.includes('malware')) {
        scanStatus = 'INFECTED';
        console.warn(`[Queue Scanner] Phát hiện từ khóa độc hại trong tên file: ${fileName}`);
      } else {
        // 2. Xác thực Magic Bytes từ KV
        const buffer = await env.MEDIA_KV.get(key, { type: 'arrayBuffer' });
        if (!buffer) {
          scanStatus = 'INFECTED';
          console.error(`[Queue Scanner] Không tìm thấy file trên KV: ${key}`);
        } else {
          const bytes = new Uint8Array(buffer.slice(0, 8));
          const isConsistent = await verifyMagicBytes(bytes, mimeType, fileName);
          if (!isConsistent) {
            scanStatus = 'INFECTED';
            console.warn(`[Queue Scanner] Magic bytes không khớp với định dạng tệp tin: ${fileName}`);
          }
        }
      }

      // 3. Giả lập thời gian xử lý quét virus (3 giây)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. Cập nhật Database
      await env.DB.prepare('UPDATE attachments SET scan_status = ? WHERE id = ?')
        .bind(scanStatus, attachmentId)
        .run();

      // 5. Nếu độc hại, xóa file khỏi KV và xóa dòng trong bảng attachments
      if (scanStatus === 'INFECTED') {
        await env.MEDIA_KV.delete(key);
        await env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(attachmentId).run();
        console.log(`[Queue Scanner] Đã xóa file nhiễm độc khỏi KV và DB: ${key}`);
      } else {
        console.log(`[Queue Scanner] File sạch: ${fileName}`);
      }

      // 6. Broadcast cập nhật trạng thái qua Durable Object
      if (conversationId && scanStatus !== 'INFECTED') {
        try {
          const doId = env.CONVERSATION_DO.idFromName(conversationId);
          const doStub = env.CONVERSATION_DO.get(doId);
          await doStub.fetch(`http://durable/update-scan-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachmentId, scanStatus })
          });
        } catch (doErr) {
          console.error(`[Queue Scanner] Lỗi gọi DO để broadcast trạng thái quét:`, doErr);
        }
      }

    } catch (err: any) {
      console.error(`[Queue Scanner] Lỗi xử lý message trong Queue:`, err);
    }
  }
}
