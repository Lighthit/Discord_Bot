// cronManager.js
// เก็บ state ของ node-cron task ที่กำลังรันอยู่ในหน่วยความจำแบบรวมศูนย์
// (key = `${userId}:${cronName}`)
// ทุกไฟล์ที่ต้องการ get/set/stop task ให้ import จากที่นี่ที่เดียว
// ห้ามแตะ activeCronTasks ตรงๆ จากไฟล์อื่น

const activeCronTasks = new Map();

function taskKey(userId, cronName) {
  return `${userId}:${cronName}`;
}

/**
 * เก็บ task ที่สร้างไว้แล้วลงหน่วยความจำ
 * (ถ้ามี task เดิมอยู่ ควรเรียก stopCronTask ก่อนเสมอ เพื่อกัน task ค้าง)
 */
export function setCronTask(userId, cronName, task) {
  activeCronTasks.set(taskKey(userId, cronName), task);
}

/**
 * ดึง task instance ที่กำลังรันอยู่ (หรือ undefined ถ้าไม่มี)
 */
export function getCronTask(userId, cronName) {
  return activeCronTasks.get(taskKey(userId, cronName));
}

/**
 * เช็คว่ามี task กำลังรันอยู่ไหม
 */
export function hasCronTask(userId, cronName) {
  return activeCronTasks.has(taskKey(userId, cronName));
}

/**
 * หยุด task (ถ้ามี) แล้วลบออกจาก Map
 * @returns {boolean} true ถ้ามี task ที่ถูกหยุดจริง, false ถ้าไม่มี task อยู่แล้ว
 */
export function stopCronTask(userId, cronName) {
  const key = taskKey(userId, cronName);
  const task = activeCronTasks.get(key);
  if (task) {
    task.stop();
    activeCronTasks.delete(key);
    return true;
  }
  return false;
}

/**
 * ลิสต์ key ของ task ทั้งหมดที่กำลังรันอยู่ (เผื่อใช้ debug/monitor)
 */
export function listActiveCronKeys() {
  return [...activeCronTasks.keys()];
}