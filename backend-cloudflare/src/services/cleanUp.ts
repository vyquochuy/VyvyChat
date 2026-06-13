import { Env } from "../types/env"

// Cron Cleanup Job: Xóa tệp tin và tin nhắn cũ hơn 1 tháng (30 ngày)
export async function cleanupOldMessagesAndFiles(env: Env) {
    try {
        console.log('[Cron Cleanup] Bắt đầu dọn dẹp tin nhắn và tệp tin cũ hơn 1 tháng...');
        const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

        // 1. Query danh sách các key tệp tin cần xóa dựa trên tuổi của message (JOIN với bảng messages)
        const oldAttachments = await env.DB.prepare(`
      SELECT a.storage_key 
      FROM attachments a
      JOIN messages m ON a.message_id = m.id
      WHERE m.created_at < ?
    `)
            .bind(oneMonthAgo)
            .all<{ storage_key: string }>()

        const keysToDelete = oldAttachments.results?.map(r => r.storage_key).filter(Boolean) || []

        if (keysToDelete.length > 0) {
            console.log(`[Cron Cleanup] Tìm thấy ${keysToDelete.length} tệp tin cần xóa khỏi MEDIA_KV.`)

            // 2. Xóa các key khỏi MEDIA_KV theo từng lô BATCH_SIZE = 100
            const BATCH_SIZE = 100
            for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
                const batch = keysToDelete.slice(i, i + BATCH_SIZE)
                await Promise.all(batch.map(key => {
                    return env.MEDIA_KV.delete(key).catch(err => {
                        console.error(`[Cron Cleanup] Lỗi xóa key ${key} khỏi KV:`, err)
                    })
                }))
                console.log(`[Cron Cleanup] Đã xóa lô tệp tin ${i} đến ${Math.min(i + BATCH_SIZE, keysToDelete.length)}`)
            }
        }

        // 3. Thực hiện xóa tường minh sử dụng Transaction Batch
        const batchRes = await env.DB.batch([
            env.DB.prepare('DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE created_at < ?)').bind(oneMonthAgo),
            env.DB.prepare('DELETE FROM messages WHERE created_at < ?').bind(oneMonthAgo)
        ])

        console.log(`[Cron Cleanup] Đã xóa ${batchRes[0].meta.changes || 0} hàng trong bảng attachments.`)
        console.log(`[Cron Cleanup] Đã xóa ${batchRes[1].meta.changes || 0} hàng trong bảng messages.`)
        console.log('[Cron Cleanup] Hoàn thành dọn dẹp.')
    } catch (err) {
        console.error('[Cron Cleanup] Lỗi trong tiến trình dọn dẹp:', err)
    }
}
