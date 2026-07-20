// AI/session/sessionManager.js
const sessions = new Map(); // key: sessionKey -> { messages: [], updatedAt: number }

const MAX_HISTORY_MESSAGES = 20; // เก็บแค่ N ข้อความล่าสุด กันบวม/กิน token
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 นาที idle แล้วเคลียร์อัตโนมัติ

function getSessionKey(userData, interaction) {
    // แยก session ตาม user + channel เพื่อไม่ให้ history ปนกันข้ามห้อง
    return `${userData.id}:${interaction.guild?.id || "Direct_msg"}:${interaction.channel?.id || "Direct_msg"}`;
}

export function getHistory(userData, interaction) {
    const key = getSessionKey(userData, interaction);
    const session = sessions.get(key);

    if (!session) return [];

    // เช็ค TTL, ถ้า idle นานเกินไปให้เคลียร์ทิ้ง
    if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
        sessions.delete(key);
        return [];
    }

    return session.messages;
}

export function appendMessages(userData, interaction, newMessages) {
    const key = getSessionKey(userData, interaction);
    const session = sessions.get(key) ?? { messages: [], updatedAt: Date.now() };

    session.messages.push(...newMessages);

    // ตัด history เก่าถ้ายาวเกิน
    if (session.messages.length > MAX_HISTORY_MESSAGES) {
        session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES);
    }

    session.updatedAt = Date.now();
    sessions.set(key, session);
}

export function clearHistory(userData, interaction) {
    const key = getSessionKey(userData, interaction);
    sessions.delete(key);
}