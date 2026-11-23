// ============================================================
//  إعدادات منصة حصر الموظفين – شركة محمد رشيد الرشيد للتجارة
//  هذا هو الملف الوحيد الذي يُعدَّل عند التفعيل.
// ============================================================

window.APP_CONFIG = {
  // 1) الصقي هنا إعدادات مشروع Firebase (من: Project settings ← Your apps ← SDK setup and configuration)
  firebase: {
    apiKey: "AIzaSyD-RYGtcWJxPey4XInE5kmk99r08lnvdDo",
    authDomain: "rr-employees.firebaseapp.com",
    projectId: "rr-employees",
    storageBucket: "rr-employees.firebasestorage.app",
    messagingSenderId: "954059321588",
    appId: "1:954059321588:web:76bec94ee8dafaa56aeea1"
  },

  // 2) البريد (Gmail) المسموح له بدخول لوحة التحكم. يمكن إضافة أكثر من بريد.
  adminEmails: [
    "bader9588@gmail.com"
  ],

  // 3) اسم المعدّة الذي يظهر أسفل الصفحات وفي رسائل الدعوة
  preparedBy: "فاتن النغيمشي",
  preparedByTitle: "مديرة القسم النسائي",

  companyName: "شركة محمد رشيد الرشيد للتجارة",
  projectName: "حصر وتحديث بيانات الموظفين"
};
