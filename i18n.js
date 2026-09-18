// TR->EN arayüz çevirmeni. Bu dosya hiçbir metni Türkçe kaynağında değiştirmez;
// yalnızca "en" dili seçiliyken DOM'daki metinleri sözlükten eşleştirip yerinde
// değiştirir (ve gelecekteki her yeniden render'ı MutationObserver ile yakalar).
(function(){
  const TR_EN = {
    // --- Genel / ortak ---------------------------------------------------
    'Kaydet':'Save','İptal':'Cancel','İptal Et':'Cancel','Vazgeç':'Cancel','× Vazgeç':'× Cancel',
    'Sil':'Delete','Düzenle':'Edit','Ekle':'Add','Ara':'Search','Kapat':'Close','Onayla':'Approve',
    'Reddet':'Reject','Gönder':'Send','Yenile':'Refresh','↻ Yenile':'↻ Refresh','İndir':'Download',
    '⬇ İndir':'⬇ Download','Önizle':'Preview','Kopyala':'Copy','Kaldır':'Remove','Seçin':'Select',
    'Tümü':'All','Durum':'Status','DURUM':'STATUS','Departman':'Department','DEPARTMAN':'DEPARTMENT',
    'Departman *':'Department *','Telefon':'Phone','E-posta':'Email','Rol':'Role','ROL':'ROLE',
    'Açıklama':'Description','Evet':'Yes','Hayır':'No','Tarih':'Date','TARİH':'DATE','Not':'Note','Not:':'Note:',
    'Aktif':'Active','Pasif':'Inactive','Kapalı':'Closed','Etkin':'Enabled','Kilitli':'Locked',
    'Kilidi Aç':'Unlock','Yükleniyor…':'Loading…','Sayfa yükleniyor…':'Page loading…','Eşleşme yok':'No matches',
    'Kayıt yok':'No records','Kayıt bulunamadı':'Record not found','Veri yok.':'No data.',
    'Görünen kayıt':'Visible record','Eylem':'Action','Eylemler':'Actions','Tür':'Type','Kategori':'Category',
    'Kategori *':'Category *','Konu':'Subject','Konu *':'Subject *','Eşya':'Item','Detay':'Detail',
    'Test numarası':'Test number','Şifre':'Password','Yeni şifre':'New password','Yeni şifre tekrar':'Confirm new password',
    'Mevcut şifre':'Current password','Kullanıcı adı':'Username','Şifre değiştir':'Change password',
    'Çıkış yap':'Log out','Bildirimler':'Notifications','Gece modu':'Dark mode','Okundu işaretle':'Mark as read',
    'Okunmadı işaretle':'Mark as unread','Tümünü okundu işaretle':'Mark all as read','Tümünü gör →':'View all →',
    'Zorunlu mu':'Required','Grç':'Actual','Yıl':'Year','Ay':'Month','AY':'MONTH','gün':'day','boş':'empty',
    'yeni':'new','v':'v','ID':'ID','Not:':'Note:','&nbsp;':'&nbsp;','Formül:':'Formula:','Bağlantı:':'Link:',
    'Yeni bildirimler':'New notifications','Okunan bildirimler':'Read notifications',
    'Okunan bildirim yok':'No read notifications','Yeni bildirim yok':'No new notifications',
    'Doğrula (önerilen)':'Verify (recommended)',
    'Ağ güvenlik duvarı SMTP trafiğini incelediğinde (ör. WatchGuard) "Doğrulamayı atla" seçin.':'If your network firewall inspects SMTP traffic (e.g. WatchGuard), choose "Skip verification".',
    'Mevcut durum':'Current status','Yetkili düzenleme:':'Authorized edit:','Bugün':'Today','Yarın':'Tomorrow',
    'Bu hafta':'This week','Bu ay':'This month','← Önceki':'← Previous','Sonraki →':'Next →',
    'Sunucu sürümü':'Server version','● Sistem çalışıyor':'● System running','Rapor':'Report','Raporlar':'Reports',
    'Test alıcısı':'Test recipient','Test e-postası gönder':'Send test email','Test SMS gönder':'Send test SMS',
    'Doğrulamayı atla':'Skip verification','Listeyi temizle':'Clear list','Statik liste':'Static list',
    'Seçenekler puanlı':'Options are scored','Ünvan / departman':'Title / department','Selamlama':'Greeting',
    'Bu şablonda aday yok':'No candidates in this template','Kaynak dosya':'Source file','Ana dizin':'Root folder',
    'Bu klasör boş':'This folder is empty','Bu sayfa boş.':'This page is empty.',
    'Bu seçim için satır bulunamadı.':'No rows found for this selection.',
    'Önizlemek için bir dosyaya tıklayın':'Click a file to preview',
    'Bir hücreye tıklayın — formülü / değeri burada görünür.':'Click a cell — its formula / value appears here.',
    'Excel yükleniyor…':'Loading Excel…','Word yükleniyor…':'Loading Word…','Excel raporu':'Excel report',
    'Excel raporu görüntüleyici':'Excel report viewer','CSV indir':'Download CSV','Excel indir':'Download Excel',
    'Excel raporu seçili departman veya tüm departmanlar için indirilebilir.':'The Excel report can be downloaded for the selected department or all departments.',
    'Henüz bir Excel yüklenmemiş.':'No Excel file has been uploaded yet.',
    'Bu sürümü sil':'Delete this version','Eşleşen dosya bulunamadı':'No matching file found',
    'Bu dosya türü tarayıcıda önizlenemiyor — indirip açın':'This file type cannot be previewed in the browser — download and open it',
    'Yazdır / PDF':'Print / PDF','PDF Raporu Al':'Get PDF Report','⬇ PDF rapor':'⬇ PDF report',
    'Tüm grafikleri içeren yazdırılabilir rapor':'Printable report with all charts',
    'Grupları yönet':'Manage groups','Grup adı':'Group name','Henüz grup yok':'No groups yet',
    'Grup adı girin':'Enter a group name','Grup kaydedildi':'Group saved','Grup silindi':'Group deleted',
    '💾 Bu listeyi grup olarak kaydet':'💾 Save this list as a group',
    '+ Gruptan ekle…':'+ Add from group…','+ Departmandan ekle…':'+ Add from department…',
    'Grup ve departman seçimleri listeye':'Group and department selections are added to the list',
    'Kullanıcı veya personel yazın':'Type a user or employee','Kişi seçin veya yazın':'Select or type a person',
    'Listeden seçebilir veya manuel yazabilirsiniz.':'You can select from the list or type manually.',
    'Yazdıkça önceki ziyaretçiler listelenir.':'Previous visitors are listed as you type.',
    'Listede ara…':'Search in list…','Dosya ara…':'Search files…',

    // --- Giriş / kimlik doğrulama -----------------------------------------
    'Oturum açın':'Sign in','Giriş yap':'Sign in','Giriş kullanıcı adı *':'Login username *',
    'Otel yönetim sistemine devam etmek için kullanıcı bilgilerinizle giriş yapın.':'Sign in with your account to continue to the hotel management system.',
    'Çok fazla hatalı giriş denemesi':'Too many failed login attempts',
    'Yeni şifre en az 8 karakter olmalıdır.':'New password must be at least 8 characters.',
    'Yeni şifre en az 8 karakter olmalıdır':'New password must be at least 8 characters',
    'Yeni şifreler eşleşmiyor':'New passwords do not match','Şifreniz değiştirildi':'Your password has been changed',

    // --- Nav / topbar -------------------------------------------------------
    'Genel Bakış':'Overview','Puantaj ve Devam':'Timekeeping & Attendance','Puantaj ve devam':'Timekeeping & attendance',
    'Vardiya Planı':'Shift Plan','Haftalık Vardiya Planı':'Weekly Shift Plan','İzin Yönetimi':'Leave Management',
    'İzin yönetimi':'Leave management','Doğum Günleri':'Birthdays','Özlük Dosyaları':'Personnel Files',
    'Eğitim ve Gelişim':'Training & Development','Performans':'Performance','Anket':'Survey','ANKET':'SURVEY',
    'Çalışanlar':'Employees','Departmanlar':'Departments','DEPARTMANLAR':'DEPARTMENTS','CV Yönetimi':'Recruitment',
    'Güvenlik':'Security','Kayıp Eşya':'Lost & Found','Kullanıcı ve Yetkiler':'Users & Permissions',
    'Kullanıcılar':'Users','Onay Matrisi':'Approval Matrix','E-posta Ayarları':'Email Settings',
    'SMS Entegrasyonu':'SMS Integration','Personel Bütçesi':'Staff Budget','Güncel Tablo':'Current Table',
    'Kalite Yönetim Sistemi':'Quality Management System','Entegre Yönetim Sistemi':'Integrated Management System',
    'Doküman Yönetimi':'Document Management','DÖF Takip':'CAPA Tracking',
    'Kalite Hedefleri / KPI':'Quality Objectives / KPI','Yönetimin Gözden Geçirmesi':'Management Review',
    'Tedarikçi Değerlendirme':'Supplier Evaluation','Kalibrasyon / Ekipman Takibi':'Calibration / Equipment Tracking',
    'Misafir Şikayet & Memnuniyet':'Guest Complaints & Satisfaction','Marka Standart Denetimi':'Brand Standard Audit',
    'Gıda Güvenliği / HACCP':'Food Safety / HACCP','Hilton Dalaman':'Hilton Dalaman',
    'Hilton Dalaman Otel Yönetim Sistemi':'Hilton Dalaman Hotel Management System',
    'HİLTON DALAMAN · OTEL YÖNETİM SİSTEMİ':'HILTON DALAMAN · HOTEL MANAGEMENT SYSTEM',
    'Otel Yönetim Sistemi':'Hotel Management System',

    // --- Dashboard ---------------------------------------------------------
    'İK durum dashboard\'u':'HR status dashboard','Toplam çalışan':'Total employees',
    'Aktif çalışan':'Active employees','Aktiflik oranı':'Activity rate','↗ Bu ay +2,4%':'↗ +2.4% this month',
    'Bekleyen izin':'Pending leave','Bu ay izin talebi':'Leave requests this month',
    'Departman dağılımı':'Department distribution','Kıdem dağılımı':'Tenure distribution',
    'Son çalışanlar':'Recent employees','Bugün izinli ve raporlu çalışanlar':'Employees on leave or sick today',
    'Bugün izinli veya raporlu çalışan bulunmuyor.':'No employees on leave or sick today.',
    'Bugün doğum günü olan yok':'No one has a birthday today','Yarın doğum günü olan yok':'No one has a birthday tomorrow',
    'Bu ay yıl dönümü yok':'No work anniversaries this month','Ay içinde işe giriş yıl dönümü':'Hire-date anniversary this month',
    '● Kadro durumu':'● Staffing status','Kadro ve ücret özetleri':'Staffing & pay summaries',

    // --- Çalışanlar / Employees ---------------------------------------------
    'Çalışan':'Employee','Çalışan *':'Employee *','Çalışan bulunmuyor':'No employees found',
    '+ Çalışan ekle':'+ Add employee','Çalışan kayıtları':'Employee records','Çalışan ataması':'Employee assignment',
    'Çalışan yıllık izinleri':'Employee annual leave','Ad soyad *':'Full name *','Ad Soyad':'Full Name',
    'İşe giriş tarihi *':'Hire date *','İŞE GİRİŞ':'HIRE DATE','İLK İŞE GİRİŞ':'FIRST HIRE DATE',
    'İş bilgileri':'Job information','İşten ayrılan kaydı yok':'No departed employee records',
    'İŞ YERİ':'WORKPLACE','Personel *':'Employee *','Personel kartları':'Employee cards',
    'Özlük bilgileri, kıdem ve yıllık izin bakiyesi':'Personnel details, tenure, and annual leave balance',
    'Özlük bilgileri ve kadro durumu':'Personnel details and staffing status',
    'Özlük dosyaları ve belge takibi':'Personnel files and document tracking',
    'Çalışan adı…':'Employee name…','Çalışan, departman veya açıklama ara…':'Search employee, department, or description…',
    'Çalışan, kategori veya açıklama ara…':'Search employee, category, or description…',
    'Çalışan, sicil veya departman ara…':'Search employee, ID, or department…',
    'İsim, pozisyon, sicil…':'Name, position, ID…','İsim veya departman ara…':'Search name or department…',
    'Çalışan eklendi':'Employee added','Çalışan güncellendi':'Employee updated','Çalışan silindi':'Employee deleted',
    'Çalışan veritabanına eklendi':'Added to the employee database','Çalışan ve tarihleri kontrol edin':'Check the employee and dates',
    'Çalışan, tarih ve pozitif tutar zorunludur':'Employee, date and a positive amount are required',
    'Ad ve departman zorunludur':'Name and department are required',
    'Sunucuya ulaşılamadı; çalışan kaydedilmedi':'Could not reach the server; employee not saved',

    // --- Departmanlar ---------------------------------------------------------
    'Departman seçin':'Select department','Departman kayıtları':'Department records',
    'Departman kayıtları şu anda alınamadı.':'Department records could not be retrieved right now.',
    'Departman kayıtları yükleniyor…':'Loading department records…','Departman sayısı':'Number of departments',
    'Departman bazında ücret özeti':'Pay summary by department','Departman karşılaştırma':'Department comparison',
    'Departman ve personel eşitlemesi':'Department and staff sync','Tüm departmanlar':'All departments',
    'Tüm durumlar':'All statuses','Önce departman seçin':'Select a department first',
    'Departmana açıldı':'Opened to department','Departmanınıza açılan düzeltici/önleyici faaliyetler':'Corrective/preventive actions opened to your department',
    'Tüm departmanlara açılan düzeltici/önleyici faaliyetler':'Corrective/preventive actions opened to all departments',
    'Departmanınızdan otomatik belirlenir':'Determined automatically from your department',
    'Departman yöneticisi → İnsan Kaynakları → Mali İşler sıralı onay akışı':'Department Manager → Human Resources → Finance sequential approval flow',
    'DEPARTMAN / PERSONEL':'DEPARTMENT / STAFF','ÇALIŞAN / DEPARTMAN':'EMPLOYEE / DEPARTMENT',
    'POZİSYON / DEPARTMAN':'POSITION / DEPARTMENT','ÇALIŞAN / KATEGORİ':'EMPLOYEE / CATEGORY',
    'En az bir departman seçin':'Select at least one department',

    // --- İzin / Leave -----------------------------------------------------------
    'Yıllık izin':'Annual leave','Yıllık İzinler':'Annual Leaves','Yıllık izin yönetimi':'Annual leave management',
    'Yıllık izin bakiyesi':'Annual leave balance','Yıllık izin bakiyeleri yükleniyor…':'Loading annual leave balances…',
    'Yıllık izin bilgileri yükleniyor…':'Loading annual leave information…',
    'Kullanılabilir yıllık izin bakiyesi:':'Available annual leave balance:',
    'Yıllık izin bakiyesi güncellendi':'Annual leave balance updated',
    'Talepleri ve yıllık izin bakiyelerini yönetin':'Manage requests and annual leave balances',
    '+ İzin talebi':'+ Leave request','İzin talepleri':'Leave requests','İzin Talepleri':'Leave Requests',
    'Gösterilecek izin talebi yok':'No leave requests to show','Henüz izin talebi yok':'No leave requests yet',
    'İzin talebi oluşturuldu':'Leave request created','İzin talebi silindi':'Leave request deleted',
    'İzin talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin':'Link your user account to an employee record to submit leave requests',
    'İzin onaylandı':'Leave approved','İzin değerlerini kontrol edin':'Check the leave values',
    'İzin türü':'Leave type','İZİN TÜRÜ':'LEAVE TYPE','Ücretsiz izin':'Unpaid leave','Mazeret izni':'Compassionate leave',
    'Hastalık izni':'Sick leave','Bekliyor':'Pending','Onayla':'Approve','Onaylandı':'Approved','Reddedildi':'Rejected',
    'Onay sürecinde':'In approval','Onay Sürecinde':'In Approval','İşlem bekliyor':'Awaiting action',
    'İK\'da bekliyor':'Pending with HR','GM onayına gönder':'Send for GM approval',
    'İşaretlenirse İK onayından sonra talep Genel Müdür onayına gider':'If checked, the request goes to General Manager approval after HR approval',
    'İzin, masraf ve avans taleplerinin departman bazlı sıralı onay akışını yönetin':'Manage the department-based sequential approval flow for leave, expense, and advance requests',
    'Sıralı onay süreci ve talep sonuçları':'Sequential approval process and request outcomes',
    'Sıralı onay ve ödeme takibi':'Sequential approval and payment tracking',
    'Onay Yetki Matrisi':'Approval Authority Matrix','Matrisi kaydet':'Save matrix',
    'Matris oluşturmak için önce çalışanlara departman tanımlayın.':'Assign departments to employees before creating a matrix.',
    'Bir adım tamamlanmadan sonraki onaycı talebi göremez. Yapılan değişiklikler yalnızca yeni oluşturulan taleplere uygulanır.':'The next approver cannot see the request until a step is completed. Changes apply only to newly created requests.',
    '+ Onay adımı':'+ Approval step','Onay adımını kaldır':'Remove approval step',
    'Başlangıç *':'Start *','Bitiş *':'End *','Başlangıç tarihi':'Start date','Bitiş tarihi':'End date',
    'BAŞLAMA':'START','BİTİŞ':'END','Tarihleri seçtiğinizde çalışma günü hesaplanır.':'Working days are calculated once you pick dates.',
    'Tarihleri kontrol edin':'Check the dates',
    'Bitiş tarihi başlangıçtan en fazla 40 gün sonra olabilir':'End date can be at most 40 days after the start date',
    'Seçilen aralıkta çalışma günü yok':'There are no working days in the selected range',
    'Talep nedeni':'Request reason','Talep açıklaması zorunludur':'Request description is required',
    'Ret nedeni zorunludur':'Rejection reason is required','Talep silindi':'Request deleted',
    'Kalan':'Remaining','KALAN':'REMAINING','kalan gün':'days remaining','Kalan izne göre çalışanlar':'Employees by remaining leave',
    'En çok izni kalandan aşağı doğru':'Most remaining leave first','BU YIL HAK EDİLEN':'ENTITLED THIS YEAR',
    'TOPLAM HAK EDİLEN':'TOTAL ENTITLED','Toplam hak':'Total entitlement','KULLANILAN':'USED','Kullanılan':'Used',
    'Kullanım detayı':'Usage detail','Hakedişler ve puantajdan gün gün kullanılan izinler':'Entitlements and day-by-day leave usage from timekeeping',
    'Güncel bakiye, İzin Yönetimi ekranında puantajdaki Yıllık İzin günlerinden hesaplanır.':'The current balance is calculated from Annual Leave days in timekeeping, shown in Leave Management.',
    '1–5 yıl kıdem: 14 gün':'1–5 years tenure: 14 days','5–15 yıl kıdem: 20 gün':'5–15 years tenure: 20 days',
    '15 yıl ve üzeri: 26 gün':'15 years and over: 26 days','İzin hesaplama kuralı':'Leave calculation rule',
    'İzin kaydı bulunamadı':'No leave record found','Bu çalışan için izin kaydı bulunmuyor':'No leave records for this employee',
    'Bu çalışan için Bordro ayrıntısı bulunmuyor.':'No payroll detail for this employee.',
    'Departman izin özeti':'Department leave summary','Filtrelenebilir kadro, izin ve kıdem raporları':'Filterable staffing, leave, and tenure reports',
    'Haftalık izin günü seçilene kadar onaya gönderilemez':'Cannot be sent for approval until the weekly off day is selected',
    'Önce haftalık izin (of) gününü seçin':'Select the weekly off day first',
    '6 günden uzun izinlerde haftalık izin günü tek bir gün olarak işaretlenir; bu gün izinden düşülmez.':'For leaves longer than 6 days, the weekly off day is marked as a single day and is not deducted from leave.',
    'Yeni oy geldi — rapor güncellendi':'New vote received — report updated',

    // --- Puantaj / Attendance ------------------------------------------------
    'Fazla mesai:':'Overtime:','Fazla Mesai':'Overtime','Vardiya ve fazla mesai puantajla anlık senkronize olur':'Shifts and overtime sync instantly with timekeeping',
    'Normal satırında durum, Fazla satırında katsayı seçilir.':'Select a status in the Normal row and a factor in the Overtime row.',
    'Normal satırında puantaj kodları, Fazla Mesai satırında saat değerleri kullanılır.':'The Normal row uses timekeeping codes, the Overtime row uses hour values.',
    'Sistem yöneticisi ve İK kullanıcıları tüm puantaj dönemlerinde değişiklik yapabilir.':'System administrators and HR users can make changes in any timekeeping period.',
    'İK bu günü R (rapor) olarak işaretledi; değiştirilemez':'HR marked this day as R (sick report); it cannot be changed',
    'Puantaj kaydedildi':'Timekeeping saved','Puantaj sunucuya kaydedildi':'Timekeeping saved to the server',
    'Vardiya kaydedildi ve puantajla eşleştirildi':'Shift saved and matched with timekeeping',
    'Planlama haftası':'Planning week','Planlandı':'Planned','Normal':'Normal',
    'Buraya girilen vardiya/fazla mesai anında puantaja işlenir; puantajda yapılan değişiklikler de bu haftanın planına yansır. Günü geldiğinde saat 17.00\'de kalan planlar da otomatik aktarılır.':'Shifts/overtime entered here are immediately recorded in timekeeping; changes made in timekeeping also reflect in this week\'s plan. Any remaining plans are automatically transferred at 17:00 on the day.',
    'Kayıtlar yükleniyor…':'Loading records…','Görünen kayıt':'Visible record',
    'Katılmadı':'Did not attend','Katıldı':'Attended','Katılım durumu':'Attendance status','KATILIM':'ATTENDANCE',
    'Eğitim tarihi':'Training date','Eğitim planlarını ve katılım durumlarını takip edin':'Track training plans and attendance status',
    'Süresi doldu':'Expired','Sertifika verildi':'Certificate issued','Eğitim adı *':'Training name *',
    '+ Eğitim ekle':'+ Add training','Henüz eğitim kaydı yok':'No training records yet','Eğitim adı zorunludur':'Training name is required',
    'Eğitim eklendi':'Training added','Eğitmen':'Trainer','EĞİTMEN':'TRAINER','EĞİTİM':'TRAINING',
    'İsmine tıklayarak katılım durumunu ve grafikleri görün':'Click the name to see attendance status and charts',
    'Eğitim ve gelişim yönetimi':'Training and development management',

    // --- Avans / Masraf ---------------------------------------------------
    '+ Avans talebi':'+ Advance request','Avans talepleri':'Advance requests','Avans Yönetimi':'Advance Management',
    'Avans talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin':'Link your user account to an employee record to submit advance requests',
    'Gösterilecek avans talebi yok':'No advance requests to show',
    '+ Masraf talebi':'+ Expense request','Masraf talepleri':'Expense requests','Masraf Yönetimi':'Expense Management',
    'Masraf tarihi *':'Expense date *','Masraf talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin':'Link your user account to an employee record to submit expense requests',
    'Gösterilecek masraf talebi yok':'No expense requests to show','Masraf ödendi olarak işaretlendi':'Expense marked as paid',
    'Fiş / fatura no':'Receipt / invoice no','Tutar (TRY) *':'Amount (TRY) *','TUTAR':'AMOUNT','TUTAR / AÇIKLAMA':'AMOUNT / DESCRIPTION',
    'Talep tarihi *':'Request date *','TALEP TARİHİ':'REQUEST DATE','Ödendi':'Paid','MAHSUP':'OFFSET','Mahsup ayı':'Offset month',
    'Bordro mahsup ayı':'Payroll offset month','Bordro kaynaklı kayıt':'Record sourced from payroll',
    'Bordro sisteminin tamamlanmış en güncel döneminden alınır; eksik dönemler çalışanları pasife çevirmez.':'Taken from the most recently completed payroll period; incomplete periods do not deactivate employees.',
    'Bakiye yetersiz':'Insufficient balance','Kapatma talebi gönderildi':'Closing request sent','Talebi Kapat':'Close Request',

    // --- Bordro / Bütçe ----------------------------------------------------
    'Bordro':'Payroll','↻ Bordro\'dan eşitle':'↻ Sync from payroll','Son eşitleme':'Last sync',
    'Eşitlenen çalışan':'Synced employees','Eşitleniyor…':'Syncing…','Henüz Bordro eşitlemesi yapılmadı.':'Payroll has not been synced yet.',
    'Departman ve personel eşitlemesi':'Department and staff sync','Çift yönlü senkron:':'Two-way sync:',
    'Personel Bütçesi':'Staff Budget','Personel bütçesi görüntüleme yetkiniz yok.':'You do not have permission to view the staff budget.',
    'Bütçe':'Budget','Büt':'Budget','Bütçe girişi için önce bir departman seçin.':'Select a department first to enter a budget.',
    'BRÜT ÜCRET':'GROSS PAY','TOPLAM BRÜT':'TOTAL GROSS','Aylık brüt ücret':'Monthly gross pay',
    'Ortalama brüt ücret':'Average gross pay','Toplam bordro tabanı':'Total payroll base',
    'Pozisyon':'Position','POZİSYON':'POSITION','Pozisyon bazında ortalama kadro':'Average staffing by position',
    'Pozisyon listesi':'Position list','Pozisyon yok':'No positions','+ Pozisyon ekle':'+ Add position',
    'Pozisyon adı':'Position name','Gerçekleşen faaliyetler':'Actual activities','Gerçekleşen girmek için bir departman seçin.':'Select a department to enter actuals.',
    'için aylık gerçekleşen kişi sayısını girin — otomatik kaydedilir. Bütçe, pozisyon girişlerinizden gelir.':' — enter the monthly actual headcount; it saves automatically. The budget comes from your position entries.',
    'hücrelerine o ayın gerçekleşen kişi sayısını girin — otomatik kaydedilir.':'cells, enter that month\'s actual headcount — it saves automatically.',
    'Yeşil "Grç" hücrelerine':'In the green "Actual" cells','Ay Toplamı':'Month Total','Yıllık değişim':'Annual change',
    'Her ay, bir önceki yılın aynı ayıyla karşılaştırılır. Vurgulu sütun içinde bulunduğumuz ay.':'Each month is compared with the same month of the previous year. The highlighted column is the current month.',

    // --- Doküman / Belgeler --------------------------------------------------
    '+ Belge kaydı ekle':'+ Add document record','Belgeler':'Documents','Henüz belge kaydı yok':'No document records yet',
    'Belge kaydı eklendi':'Document record added','Belge kaydı silindi':'Document record deleted',
    'Belge türü':'Document type','BELGE TÜRÜ':'DOCUMENT TYPE','BELGE NO':'DOCUMENT NO','Doküman no':'Document no',
    'Doküman sahibi':'Document owner','Çalışan belgelerinin durumunu merkezi olarak izleyin':'Track employee document status centrally',
    'Kalite/İK doküman arşivi — klasör klasör gezinin':'Quality/HR document archive — browse folder by folder',
    'Revizyon no':'Revision no','Revizyon Talebi':'Revision Request','Revizyon Talep Et':'Request Revision',
    'Revizyon talebi açıklaması *':'Revision request description *','Revizyon istendi':'Revision requested',
    'Revizyon talebi Kalite departmanına gönderildi':'Revision request sent to the Quality department',
    'Revizyon talebi kapatıldı':'Revision request closed','Eşleşen doküman yok':'No matching document',
    'Listeden bir doküman seçin':'Select a document from the list','Yeni sürüm yüklendi':'New version uploaded',
    'Sürüm silindi':'Version deleted','Saklandığı yer':'Storage location','Saklandığı Yer':'Storage Location',
    'Geçerlilik tarihi':'Validity date','GEÇERLİLİK TARİHİ':'VALIDITY DATE',

    // --- KYS / DÖF ------------------------------------------------------
    'Bu modüle erişim yetkiniz yok.':'You do not have access to this module.','Bu bölüme erişim yetkiniz yok.':'You do not have access to this section.',
    'Açık DÖF\'lerim':'My open CAPAs','Kapatılmış DÖF\'lerim':'My closed CAPAs','+ Yeni DÖF Aç':'+ Open new CAPA',
    'DÖF açıldı':'CAPA opened','DÖF iptal edildi':'CAPA cancelled','DÖF kapatıldı':'CAPA closed',
    'DF Tamamlanma tarihi':'CAPA completion date','Faaliyet talebinde bulunan':'Activity requested by',
    'Faaliyet türü':'Activity type','Düzeltme açıklaması':'Correction description',
    'Düzeltme faaliyeti sorumlusu':'Corrective action owner','Kök neden':'Root cause',
    'Uygunsuzluğun kök nedeni':'Root cause of nonconformity','Uygunsuzluk kaynağı':'Source of nonconformity',
    'Tespit edilen uygunsuzluk':'Nonconformity identified','Aksiyon Yaz & Kapatma Talep Et':'Write Action & Request Closure',
    'AÇILDI':'OPENED','AÇILMA':'OPENED ON','Açılış':'Opened','Açtı':'Opened by','Termin':'Due date',
    'Onaya Gönder':'Send for Approval','Onaylı form':'Approved form','Onaylanan / tamamlanan':'Approved / completed',
    'FORM':'FORM','Yeni kayıtta durum otomatik olarak Beklemede\'dir':'Status is automatically Pending for new records',

    // --- Kullanıcı ve Yetkiler ----------------------------------------------
    'Gerçek giriş hesaplarını, rollerini ve personel bağlantılarını yönetin':'Manage real login accounts, roles, and employee links',
    'Kullanıcı ve yetki yönetimi':'User and permission management','Kullanıcı ve Yetki Yönetimi':'User and Permission Management',
    'Kullanıcılar yükleniyor…':'Loading users…','Kullanıcı bulunmuyor':'No users found','+ Kullanıcı ekle':'+ Add user',
    'KULLANICI / GİRİŞ ADI':'USER / LOGIN NAME','Kullanıcı adı, ad ve en az 8 karakterlik şifreyi kontrol edin':'Check the username, name, and a password of at least 8 characters',
    'Kullanıcı hesabı silindi':'User account deleted','Hesabın kilidi açıldı':'Account unlocked',
    'Bağlı personel':'Linked employee','DEPARTMAN / PERSONEL':'DEPARTMENT / STAFF',
    'Gruplar':'Groups','Onay Matrisi':'Approval Matrix','Onay Yetki Matrisi':'Approval Authority Matrix',
    'Seçilebilir modüller':'Selectable modules','İzinli modüller':'Permitted modules',
    'Tüm modüller eklendi':'All modules added','Henüz modül eklenmedi — soldan seçin':'No modules added yet — select from the left',
    'Rolü düzenle':'Edit role','Rol adı (değiştirilemez)':'Role name (cannot be changed)',
    '— Yeni Rol —':'— New Role —','Yeni rol adı *':'New role name *','Yeni rol için bir isim girin':'Enter a name for the new role',
    'Yeni rol için en az bir modül seçin':'Select at least one module for the new role',
    'Rol için en az bir modül seçin':'Select at least one module for the role',
    'Sadece görme':'View only','Yazma':'Write','Tam kontrol':'Full control',

    // --- SMTP / SMS ----------------------------------------------------------
    'Kullanıcılara e-posta bilgilendirmesi göndermek için merkezi SMTP hesabını tanımlayın':'Configure the central SMTP account to send email notifications to users',
    'Office 365 E-posta Ayarları':'Office 365 Email Settings','E-posta (SMTP) Ayarları':'Email (SMTP) Settings',
    'SMTP kullanıcı e-postası *':'SMTP account email *','SMTP parolası *':'SMTP password *','SMTP sunucusu':'SMTP server',
    'smtp.office365.com · Port 587 · STARTTLS. SMTP parolası şifreli saklanır ve tekrar ekranda gösterilmez.':'smtp.office365.com · Port 587 · STARTTLS. The SMTP password is stored encrypted and never shown again.',
    'Office 365 SMTP ayarları sunucuya kaydedildi':'Office 365 SMTP settings saved to the server',
    'Test e-postası başarıyla gönderildi':'Test email sent successfully','Test alıcısı e-posta adresini girin':'Enter the test recipient email address',
    'Gönderen adı':'Sender name','Gönderen e-posta *':'Sender email *','Port':'Port','TLS sertifika doğrulaması':'TLS certificate validation',
    'Sağlayıcı bağımsız HTTP SMS API\'si; onay bildirimlerini SMS ile de gönderin':'Provider-independent HTTP SMS API; also send approval notifications by SMS',
    'Sağlayıcı adı':'Provider name','Gönderimi etkinleştir':'Enable sending','HTTP metodu':'HTTP method',
    'Gönderici / başlık':'Sender / header','Şablonlarda kullanılabilir yer tutucular:':'Placeholders available in templates:',
    'Tekil gönderim gövde şablonu *':'Single-send body template *','dizisiyle değiştirilir.':'array.',
    'Doluysa anket/oylama davetleri tek istekte gönderilir.':'If filled in, survey/vote invitations are sent in a single request.',
    'Onay bildirimlerini SMS gönder':'Send SMS for approval notifications','Teknomart ön ayarı':'Teknomart preset',
    'Teknomart alanları dolduruldu — kimlik alanları ve gönderici başlığını yazıp kaydedin':'Teknomart fields filled in — enter the credential fields and sender header, then save',
    'SMS ayarları kaydedildi':'SMS settings saved','yanıtta bu metin varsa başarılı':'success if response contains this text',
    'Doğum Günü SMS\'i':'Birthday SMS','Doğum günü SMS\'ini etkinleştir':'Enable birthday SMS',
    'Her gün saat 09:00 civarında, o gün doğum günü olan çalışanlara otomatik gönderilir':'Sent automatically around 09:00 every day to employees whose birthday is that day',
    'Mesaj taslağı':'Message draft','Doğum günü ayarlarını kaydet':'Save birthday settings',
    'Doğum günü test SMS gönder':'Send test birthday SMS','Test telefon numarası girin':'Enter a test phone number',
    'Test SMS gönderildi':'Test SMS sent','SMS':'SMS','Ayarları kaydet':'Save settings',
    'Ad: değer':'Key: value','usercode=...\\npassword=...':'usercode=...\\npassword=...',

    // --- Anket / Survey / EOM ------------------------------------------------
    'Anket başlığı *':'Survey title *','Henüz anket şablonu yok':'No survey templates yet',
    '+ Yeni anket şablonu':'+ New survey template','Anket başlığı zorunludur':'Survey title is required',
    'Anket silindi':'Survey deleted','+ Yeni Make It Right şablonu':'+ New Make It Right template',
    '+ Yeni değerlendirme formu':'+ New evaluation form','Şablon adı *':'Template name *','ŞABLON':'TEMPLATE',
    'Henüz şablon yok':'No templates yet','Şablon adı girin':'Enter a template name','Şablon kopyalandı':'Template copied',
    'Şablon oluşturuldu — şimdi aday ekleyin':'Template created — now add candidates','Şablon silindi':'Template deleted',
    'Soru başlığı *':'Question title *','Soru detayı / açıklama':'Question detail / description','+ Soru ekle':'+ Add question',
    'Henüz soru yok':'No questions yet','En az bir soru başlığı girin':'Enter at least one question title',
    'Cevap tipi':'Answer type','SORU':'QUESTION','Seçenek eklenmedi':'No options added','+ Seçenek':'+ Option',
    'ör. Hiç katılmıyorum':'e.g. Strongly disagree','ör. Kesinlikle katılıyorum':'e.g. Strongly agree',
    'En düşük etiketi':'Lowest label','En yüksek etiketi':'Highest label','En düşük puan':'Lowest score','En yüksek puan':'Highest score',
    'Puanlanabilir soru yok':'No scoreable question','Bu ankette grafikli soru yok':'No chartable question in this survey',
    'Cevabınız…':'Your answer…','Yanıtları gönder':'Submit answers','Oyumu gönder':'Submit my vote',
    'Oy kullandı':'Voted','Yanıtladı':'Responded','Yanıtlayanların profili':'Respondent profile',
    'Yanıt durumu':'Response status','Henüz yazılı yanıt yok':'No written responses yet','yanıt':'response',
    'Özet ve grafikler':'Summary and charts','Seçili kapsama ait anlık dağılım':'Live distribution for the selected scope',
    'Gösterilecek veri yok':'No data to show','ALICI':'RECIPIENT','Alıcı yok':'No recipient',
    'En az bir alıcı girin':'Enter at least one recipient','Alıcı listesi temizlendi':'Recipient list cleared',
    'Her alıcıya kişiye özel,':'Personalized for each recipient,','ve alt satıra':'and on the next line',
    'Mesaja kişiye özel selamlama ekle':'Add a personalized greeting to the message','Gönderim kanalı':'Delivery channel',
    'Boş bırakılırsa standart metin gönderilir. {ad} = Ad SOYAD, {link} = bağlantı.':'If left empty, the standard text is sent. {ad} = FULL NAME, {link} = link.',
    'Gönderildi':'Sent','Gönderilemedi':'Failed to send','Gönderilmedi':'Not sent','Gönderim yapılmadı':'No delivery made',
    'Henüz gönderim yok':'No deliveries yet','GÖREV':'TASK','ADAY':'CANDIDATE','Adaylar':'Candidates',
    '+ Aday ekle':'+ Add candidate','Aday adı *':'Candidate name *','Aday adı girin veya çalışan seçin':'Enter a candidate name or select an employee',
    'Aday adı zorunludur':'Candidate name is required','Aday güncellendi':'Candidate updated','Aday silindi':'Candidate deleted',
    'Henüz aday kaydı yok':'No candidates yet','aday seçilebilir.':'candidate(s) can be selected.',
    'Önce adaya bir departman atayın (Düzenle)':'Assign a department to the candidate first (Edit)',
    'Sol sütun operasyon, sağ sütun idari ofis adayları. Oy verenler her sütundan 1 aday seçer.':'Left column is operations candidates, right column is admin office candidates. Voters pick 1 candidate from each column.',
    'Her sütundan yalnızca':'Only from each column','Yeni yanıt geldi — rapor güncellendi':'New response received — report updated',
    'GÖRÜŞME / CV':'INTERVIEW / CV','Görüşme tarihi':'Interview date','Fotoğraf':'Photo','Fotoğraf yok':'No photo',
    'Fotoğraf yükle':'Upload photo','Fotoğraf en fazla 600 KB olabilir':'Photo can be at most 600 KB',
    'JPG / PNG / WEBP · en fazla 600 KB':'JPG / PNG / WEBP · max 600 KB','Lütfen bir resim dosyası seçin':'Please select an image file',
    'CV dosya adı':'CV file name','FR/HR/015 · yetkinlik bazlı öz değerlendirme — anket gönderimi ve departman raporları':'FR/HR/015 · competency-based self-assessment — survey delivery and department reports',
    'Performans Değerlendirme':'Performance Evaluation','Performans değerlendirme yönetimi için yetkiniz yok.':'You do not have permission to manage performance evaluations.',
    'Yazılı değerlendirmeler':'Written evaluations','YETKİNLİK':'COMPETENCY',
    'ör. 2026 1. Çeyrek Ayın Personeli':'e.g. Q1 2026 Employee of the Month','ör. İç Denetim, Misafir Şikayeti…':'e.g. Internal Audit, Guest Complaint…',

    // --- Güvenlik / Kayıp Eşya --------------------------------------------------
    'Kayıp Eşya':'Lost & Found','Kayıp Eşya Raporu':'Lost & Found Report','Teslim Alan':'Received By','Teslim Eden':'Handed Over By',
    'Teslim alan zorunludur':'Recipient is required','Teslim eden zorunludur':'Sender is required',
    '— Teslim alacak departmanı seçin —':'— Select the receiving department —','Teslim alacak departmanı seçin':'Select the receiving department',
    'Hareketler':'Movements','Son hareket silindi':'Last movement deleted','Kaynak dosya':'Source file',
    'KAYNAK':'SOURCE','KANAL':'CHANNEL','departmanının onaylaması bekleniyor. Bu eşya üzerinde, hedef departman onay ya da ret verene kadar işlem yapılamaz.':'department\'s approval is pending. No action can be taken on this item until the target department approves or rejects it.',
    'Transfer':'Transfer','▶▶ Transfer':'▶▶ Transfer','Transfer Departmanı':'Transfer Department',
    'Önce transfer departmanını seçin':'Select the transfer department first',
    'Transfer yalnızca durumu "Beklemede" olan eşyalar için yapılabilir':'Transfer is only possible for items with "Pending" status',
    'Hedef departman *':'Target department *','Hedef departmanın personeli listelenir; elle isim de yazabilirsiniz.':'The target department\'s staff is listed; you can also type a name manually.',

    // --- Araç Raporu -------------------------------------------------------------
    'Araç Kullanım Raporu':'Vehicle Usage Report','Araçların Aylık Kilometre Grafiği':'Vehicles\' Monthly Mileage Chart',
    'Araç':'Vehicle','Araç seçin':'Select vehicle','Tüm araçlar':'All vehicles','Çıkış Sayısı':'Number of Trips',
    'Bu araç için kayıtlı kilometre bulunamadı.':'No mileage recorded for this vehicle.','Son dönüş kilometresinden otomatik alınır':'Automatically taken from the last return mileage',

    // --- Genel form/aksiyon toast'ları -----------------------------------------
    'Bağlantı kopyalandı':'Link copied','Kopyalanamadı':'Could not copy','Açılır pencereye izin verin':'Please allow the pop-up window',
    'Kaydedildi':'Saved','Güncellendi':'Updated','Durum güncellendi':'Status updated','Kayıt silindi':'Record deleted',
    'Kayıt sunucuya yazılamadı':'Record could not be written to the server','En az bir kriter seçin':'Select at least one criterion',
    'En az bir kriter seçerek PDF raporu oluşturabilirsiniz.':'Select at least one criterion to generate a PDF report.',
    'Excel raporu oluşturulamadı':'Could not generate the Excel report','Excel yükleniyor ve işleniyor, bu biraz sürebilir…':'Excel is loading and processing, this may take a while…',
    'Yalnızca .xlsx dosyası yükleyebilirsiniz':'You can only upload .xlsx files','Dosya çok büyük (en fazla 30 MB)':'File is too large (max 30 MB)',
    'Resim en fazla 600 KB olabilir':'Image can be at most 600 KB','Zorunlu alanları doldurun':'Fill in the required fields',
    'Kullanıcı adı, ad ve en az 8 karakterlik şifreyi kontrol edin':'Check the username, name, and a password of at least 8 characters',
    'Form silindi':'Form deleted','Henüz form yok':'No forms yet','Konu zorunludur':'Subject is required',
    'Talep silindi':'Request deleted','Sistem tarafından otomatik belirlenir':'Automatically determined by the system',
    'Resmi tatil':'Public holiday','Temizle':'Clear',

    // --- Nav tekrarları (ör. index.html metinleri) --------------------------------
    'Kalibrasyon / Ekipman Takibi':'Calibration / Equipment Tracking',

    // --- Ek / ikinci geçiş -----------------------------------------------------
    'Aday eklenmedi':'No candidate added','Aksiyon Yaz &amp; Kapatma Talep Et':'Write Action & Request Closure',
    'Bağlantı yok':'No connection','BAŞARISIZ':'FAILED','Başarısız':'Failed','BİRİM':'UNIT',
    'Bir veya birden fazla departman seçin. Grup her gönderimde bu departmanların güncel çalışanlarını içerir.':'Select one or more departments. The group includes these departments\' current employees on every send.',
    '↻ Bordro’dan eşitle':'↻ Sync from payroll','ÇALIŞAN':'EMPLOYEE','ÇALIŞMA TİPİ':'WORK TYPE','Çalışma tipi':'Work type',
    'DEP.':'DEPT.',', departman girer. Liste':', enter department. List',
    'Durum / not':'Status / note','DURUM / ONAY AKIŞI':'STATUS / APPROVAL FLOW','Düzenleme sınırı:':'Edit limit:',
    'eklenir':'is added','Eksik':'Missing','— elle gir —':'— enter manually —','+ Elle satır':'+ Manual row',
    'Fark':'Difference','FARK':'DIFFERENCE','GENEL':'GENERAL',
    'Gösterilecek çalışan yok':'No employees to show','GRUP':'GROUP',
    'Güncel kadro, izin ve rapor durumlarını tek ekranda izleyin.':'Track current staffing, leave, and report statuses on a single screen.',
    'Haftalık vardiya planı':'Weekly shift plan','HAFTA T.':'WEEK TOT.','HD':'HD',
    'henüz kaydedilmedi':'not saved yet','Henüz kayıt yok':'No records yet','Henüz veri yok':'No data yet',
    'Her mesaj':'Each message','İK\'da bekliyor':'Pending with HR','İK ONAYI':'HR APPROVAL','İletişim':'Contact',
    'İşlem Tarihi':'Transaction Date','İzinli':'On leave','İzin yönetimine git →':'Go to leave management →',
    'kaldırıldı':'removed','Mevcut dosya:':'Current file:','Onay bekliyor':'Awaiting approval','Raporlu':'Sick report',
    'ORT.':'AVG.','ORTALAMA':'AVERAGE','Resim':'Image','RESMİ T.':'OFFICIAL T.',
    'SÜRE':'DURATION','Tamamlandı':'Completed','tek kullanımlık':'single-use','TOPLAM':'TOTAL',
    'ULAŞTI':'REACHED','Ulaştı':'Reached','ÜYE':'MEMBER','ve alt satıra':'and on the next line',
    '+ Yeni':'+ New','+ Yeni kayıt':'+ New record','Yeşil':'Green',
    'yılından geldi — aylık sayılar':'came from the year — monthly figures',
    'Aksiyon açıklaması zorunludur':'Action description is required','İşten Çıkış':'Termination',
    '▣ Kaydet':'▣ Save','sicil':'ID no','Örn. Gece Vardiyası Sorumlusu':'e.g. Night Shift Supervisor',
    'puan':'points','Departman seçilince belirlenir':'Determined once department is selected',
    'Yazmaya başlayın…':'Start typing…',

    // --- Üçüncü geçiş: modül-özel ekranlar (KYS alt modülleri, HMS, işe alım, vb.) ---
    '0-1 yıl':'0-1 years','10-15 yıl':'10-15 years','10 günden az':'less than 10 days','15 gün ve üzeri':'15 days or more',
    '1-5 yıl':'1-5 years','15+ yıl':'15+ years','20 gün ve üzeri':'20 days or more','5-10 yıl':'5-10 years','5 günden az':'less than 5 days',
    'Açık':'Open','Açık uçlu (yazı)':'Open-ended (text)','Açtı, oy kullanmadı':'Opened, did not vote','Açtı, yanıtlamadı':'Opened, did not respond',
    'Aday departmana açıldı':'Candidate opened to department','Aday departmandan geri alındı':'Candidate withdrawn from department',
    'Aday düzenle · ':'Edit candidate · ','Aday ekleyin, departman atayın ve departmana açın.':'Add candidates, assign a department, and open to the department.',
    'Adayı düzenle':'Edit candidate','Aday kaydını silmek istediğinize emin misiniz?':'Are you sure you want to delete this candidate record?',
    'Ağustos':'August','AKTİF':'ACTIVE','Aktif olarak çalışıyor':'Currently active','Alıcı grupları':'Recipient groups',
    '(anket başlığı)':'(survey title)','Anket şablonunu düzenle':'Edit survey template','Araç Hata Durumu':'Vehicle Fault Status',
    'Araçlar':'Vehicles','Araç Takipleri':'Vehicle Tracking','Aralık':'December','Avans tamamen onaylandı':'Advance fully approved',
    'Ayakkabı/Terlik':'Shoes/Slippers','Ayın Personeli seçimi':'Employee of the Month selection','Ayrılan':'Departed','Ayrıldı':'Departed',
    '● Bağlantı ayarı eksik':'● Connection setting missing','Bakiye alınamadı':'Could not retrieve balance',
    'BAŞLANGIÇ':'START','Başlangıç':'Start','Başlangıç Km':'Start Mileage','(başlıksız soru)':'(untitled question)',
    'Belge kaydı':'Document record','Bitiş':'End','Bitiş tarihini yeniden seçin.':'Reselect the end date.',
    'Bölge yöneticisi':'Regional manager','Bölüm':'Section','Bölüm / mutfak':'Section / kitchen',
    'Bordro ayrıntıları alınamadı':'Could not retrieve payroll details','● Bordro bağlantısı hazır':'● Payroll connection ready',
    'Bordro durumu alınamadı':'Could not retrieve payroll status','Bordro eşitlemesi tamamlanamadı':'Payroll sync could not complete',
    'Brüt ücret':'Gross pay','Bu adayı silmek istediğinize emin misiniz?':'Are you sure you want to delete this candidate?',
    'Bu anket şablonunu silmek istediğinize emin misiniz?':'Are you sure you want to delete this survey template?',
    'Bu çalışanı silmek istediğinize emin misiniz?':'Are you sure you want to delete this employee?',
    'Bu DÖF kaydını iptal etmek istediğinize emin misiniz?':'Are you sure you want to cancel this CAPA record?',
    'Bu dokümanı iptal etmek istediğinize emin misiniz?':'Are you sure you want to cancel this document?',
    'Bu Excel sürümünü silmek istediğinize emin misiniz?':'Are you sure you want to delete this Excel version?',
    'Bu formu silmek istediğinize emin misiniz?':'Are you sure you want to delete this form?',
    'Bu grubu silmek istediğinize emin misiniz?':'Are you sure you want to delete this group?',
    'Bugün izinli':'On leave today','Bugün raporlu':'On sick report today',
    'Bu kaydı silmek istediğinize emin misiniz?':'Are you sure you want to delete this record?',
    'Bu kullanıcı hesabını silmek istediğinize emin misiniz?':'Are you sure you want to delete this user account?',
    'Bu numara sistemde kayıtlı bir çalışana ait değil':'This number is not registered to any employee in the system',
    'Bu pozisyon satırını silmek istiyor musunuz?':'Do you want to delete this position row?',
    'Bu şablonu silmek istediğinize emin misiniz? Gönderilmiş linkler ve oylar da silinir.':'Are you sure you want to delete this template? Sent links and votes will also be deleted.',
    'Bu sürüm için kısa not (opsiyonel):':'Short note for this version (optional):',
    'Bu tarih için 2 günlük düzeltme süresi doldu':'The 2-day correction window for this date has expired',
    'Bütçe Tablosu':'Budget Table','Bu vardiya günü için değişiklik süresi doldu':'The change window for this shift day has expired',
    'Bu yıl hak edilen':'Entitled this year','ÇALIŞMA SÜRESİ':'WORK DURATION','çalışan':'employee',
    'Çalışan detayı':'Employee detail','Çalışan durumları':'Employee statuses','Çalışanı düzenle':'Edit employee',
    'Çalışan Takipleri':'Employee Tracking','Çalışma süresi (yıl)':'Work duration (years)',
    'Çanta':'Bag','Çar':'Wed','ÇHT':'ÇHT','ÇIKIŞ':'CHECK-OUT','Çizelge':'Schedule','Çıkış':'Check-out',
    'Çıkış Km':'End Mileage','Çıkış tarihi':'Check-out date','Çıkış Tarihi':'Check-out Date','Çıkış Yaptı':'Checked Out',
    'Çok seçim':'Multiple choice','ÇRT':'ÇRT','ÇRT.':'ÇRT.',
    'Değerlendirme tarihi':'Evaluation date','Değerli Eşya':'Valuables','Değişmeyecekse boş bırakın':'Leave blank if unchanged',
    'Denetçi':'Auditor','Denetim alanı / konu':'Audit area / subject','Departmana aç':'Open to department',
    'Departman atanmadı':'No department assigned','Departman bazlı kalite hedefleri ve gerçekleşme takibi':'Department-based quality objectives and achievement tracking',
    'departmanınız':'your department','Departmanınız':'Your department',
    'Departmanınız için İK tarafından onaylanmış adaylar. Durum ve notu güncelleyebilirsiniz.':'Candidates approved by HR for your department. You can update status and notes.',
    'Departman kayıtları alınamadı':'Could not retrieve department records','Departman Özeti':'Department Summary',
    'Departman yöneticisi':'Department manager','Devir oranı':'Turnover rate','Diğer':'Other',
    'DÖF — düzenle':'CAPA — edit','Doküman':'Document','Doküman adı':'Document name','Doküman onayı':'Document approval',
    'Dönem':'Period','Dönem (ör. 2026 Ç3)':'Period (e.g. 2026 Q3)','Dönüş Km':'Return Mileage','Dönüş Tarihi':'Return Date',
    'Dönüş Yaptı':'Returned','Dosya yüklenemedi':'File could not be uploaded','Düzeltici':'Corrective',
    'Düzeltici faaliyet':'Corrective action','Düzeltildi':'Corrected',
    '"Düzeltildi" işaretlemeden önce düzeltici faaliyet alanını doldurun':'Fill in the corrective action field before marking "Corrected"',
    '✎ Düzenlemeye dön':'✎ Back to editing','Eğitim':'Training','Ekipman adı':'Equipment name',
    'En güncel Bordro dönemi ile personel ve departman bilgileri eşitlensin mi?':'Sync employee and department information with the latest payroll period?',
    'Entegre Yönetim Sistemi Kayıtlar':'Integrated Management System Records',
    'E-posta adresi olan alıcı yok':'No recipient has an email address','E-posta belirtilmemiş':'Email not specified',
    'Eşitleme tamamlanamadı':'Sync could not complete','Eşleşen personel yok — elle yazabilirsiniz':'No matching employee — you can type manually',
    'Evet / Hayır':'Yes / No','Eylül':'September','Finans Uzmanı':'Finance Specialist','Finans yöneticisi':'Finance manager',
    'Form güncellendi':'Form updated','Form oluşturuldu':'Form created','Geçen Yılla Karşılaştırma':'Comparison with Last Year',
    'Geliştirici':'Developer','Genel müdür':'General manager','Genel müdür yardımcısı':'Deputy general manager',
    'Gerçekleşen':'Actual','Gideceği Yer':'Destination','Giriş':'Check-in','Giriş yapılamadı':'Could not sign in',
    'Giriş Yaptı':'Checked In','Gönderen':'Sender','Gönderilen anketler':'Sent surveys','Gönderilen Make It Right anketleri':'Sent Make It Right surveys',
    'Görevde':'On duty','Gösterge (KPI)':'Indicator (KPI)','Gözlük':'Glasses','Grubu düzenle':'Edit group',
    'Grup adı:':'Group name:','Grup güncellendi':'Group updated','Grup oluşturuldu':'Group created',
    'Gün':'Day','GÜN':'DAY','Güncel çalışan':'Current employee','Günübirlik':'Day trip','GÜVENLİK':'SECURITY',
    'Hedef değer':'Target value','Henüz eşitlenmedi':'Not synced yet','Henüz Giriş Yapmadı':'Not Checked In Yet',
    'Hesap menüsü':'Account menu','Hiç açmadı':'Never opened','İçeride':'Inside','İdari Ofis Çalışanları':'Admin Office Employees',
    'İK bu günü R (rapor) olarak işaretledi':'HR marked this day as R (sick report)','İK Merkezi':'HR Center',
    'İK Uzmanı':'HR Specialist','İK yöneticisi':'HR manager','İletişim bilgisi yok':'No contact information',
    'İlgili departman':'Related department','İlk Excel dosyasını yükle':'Upload the first Excel file',
    'İlk işe giriş':'First hire date','İnceleniyor':'Under review','İNSAN KAYNAK':'HUMAN RESOURCES','İNSAN KAYNAKLARI':'HUMAN RESOURCES',
    'İnsan Kaynakları':'Human Resources','İptal edildi':'Cancelled','İşe alındı':'Hired','İşe giriş':'Hire date','İsim':'Name',
    'İşlem tamamlanamadı':'Operation could not be completed','İş sözleşmesi':'Employment contract',
    'İşten Ayrılanlar':'Departed Employees','İşyeri':'Workplace','İŞYERİ':'WORKPLACE','İzin':'Leave',
    'İzin kullanım detayı':'Leave usage detail','İzin onayı':'Leave approval','İzin reddedildi':'Leave rejected',
    'İzin talebi':'Leave request','İzin talebini silmek istediğinize emin misiniz?':'Are you sure you want to delete this leave request?',
    'İzin talepleri yüklenemedi':'Could not load leave requests','İzin tamamen onaylandı':'Leave fully approved',
    'KALİTE':'QUALITY','Kalite El Kitabı':'Quality Manual','Kalite el kitabı, prosedür, talimat ve formların versiyon kontrolü':'Version control of the quality manual, procedures, instructions, and forms',
    'Kapatıldı':'Closed','Kapatmadan önce bulgular ve düzeltici faaliyet alanlarını doldurun':'Fill in the findings and corrective action fields before closing',
    'Kapatmadan önce kök neden ve aksiyon alanlarını doldurun':'Fill in the root cause and action fields before closing',
    'Kasım':'November','KAT HİZMETLERİ':'HOUSEKEEPING','Katılımcılar':'Participants','Kaydı düzenle':'Edit record',
    'Kayıp/bulunan eşya kaydı, departman transferi ve raporlar':'Lost/found item records, department transfer, and reports',
    'Kayıp/Bulunan Eşyalar':'Lost/Found Items','Kayıp/Bulunma Tarihi':'Lost/Found Date','Kayıp/Bulunma Tarihi ve Saati':'Lost/Found Date and Time',
    'Kayıt':'Record','Kayıt eklendi':'Record added','Kayıt güncellendi':'Record updated',
    'Kayıtlı · değiştirmek için yazın':'Saved · type to change','Kayıt oluşturuldu':'Record created','Kimlik Kartı':'ID Card',
    'kişi':'person','Kişi':'Person','Kişi Sayısı':'Number of People','Kıdem ve Yıl Dönümü':'Tenure and Anniversary',
    'Kıdem (yıl)':'Tenure (years)','Kritik kontrol noktası (CCP)':'Critical control point (CCP)',
    'Kullanıcı güncellendi':'User updated','Kullanıcı hesabı oluşturuldu':'User account created','Kullanıcıyı düzenle':'Edit user',
    'Kullanım Dışı':'Out of Service','KVKK aydınlatma':'Data privacy notice','Link gönder':'Send link',
    'LQA / mystery guest tipi departman kontrol turları ve puanlama':'LQA / mystery guest style department inspection rounds and scoring',
    'Mağaza':'Store','Make It Right şablonu':'Make It Right template','Mali İşler':'Finance','MALİ İŞLER':'FINANCE',
    'Masraf tamamen onaylandı':'Expense fully approved','Mayıs':'May','Menü':'Menu','Misafir adı':'Guest name',
    'MİSAFİR İLİŞKİLERİ':'GUEST RELATIONS','Misafir şikayetlerinin kalite bakış açısıyla kayıt, kök neden ve kapatma takibi':'Recording, root-cause, and closure tracking of guest complaints from a quality perspective',
    'Mülakat':'Interview','Mutfak-restoran için kritik kontrol noktaları (CCP) ve kayıtları':'Critical control points (CCP) and records for kitchen-restaurant',
    'Normal Çalışma':'Regular Work','Ölçülen':'Measured','Ölçülen değer':'Measured value',
    'Ölçüm ve teknik ekipmanların kalibrasyon takvimi':'Calibration schedule for measurement and technical equipment',
    'Oluştur':'Create','Onaya gönderildi':'Sent for approval','Onaylandı ve yürürlüğe girdi':'Approved and in effect',
    'Onaylı':'Approved','Onaylı gün':'Approved day','ÖN BÜRO':'FRONT OFFICE','Önceki aylarda puantaj değiştirilemez':'Timekeeping cannot be changed for previous months',
    'Ön görüşme':'Preliminary interview','👁 Önizleme':'👁 Preview','Önizleme · ':'Preview · ','Önleyici':'Preventive',
    'Operasyon Çalışanları':'Operations Employees','Ortak kayıt sunucuya yazılamadı':'Shared record could not be written to the server',
    'Ortak veri yüklenemedi':'Shared data could not be loaded','Ortalama brüt':'Average gross','Ortalama kıdem (yıl)':'Average tenure (years)',
    'ORT. BRÜT':'AVG. GROSS','Parolayı girin':'Enter the password','Personel bağlantısı yok':'No employee link',
    'Pozisyon belirtilmemiş':'Position not specified','Prosedür':'Procedure','Puanlama (ölçek)':'Rating (scale)',
    'Puantaj dönemi':'Timekeeping period','Puantaj kayıtları alınamadı':'Could not retrieve timekeeping records',
    'Red gerekçesi (isteğe bağlı):':'Rejection reason (optional):','Ret nedenini yazın:':'Enter the rejection reason:',
    'Sadece görüntüleme':'View only','Sağlık raporu':'Medical report','Şartlı Onaylı':'Conditionally Approved',
    'Satış':'Sales','Satış Yöneticisi':'Sales Manager','Seçili departman':'Selected department',
    'Seçili haftalık izin: <strong>':'Selected weekly off: <strong>','Şifre *':'Password *','Şifre değiştirilemedi':'Password could not be changed',
    'Şikayet':'Complaint','Sistem yöneticisi':'System administrator','Sıfır ( = 0 )':'Zero ( = 0 )','Şubat':'February',
    'Sunucu işlemi tamamlanamadı':'Server operation could not be completed','Süresi Geçti':'Expired','Sürücü':'Driver',
    'Takı':'Jewelry','Talebi silmek istediğinize emin misiniz?':'Are you sure you want to delete this request?',
    'Tamamlanan yıl':'Completed year','Tedarikçi':'Supplier','Tedarikçi adı':'Supplier name',
    'Tedarikçi performans ve uygunluk değerlendirme kayıtları':'Supplier performance and compliance evaluation records',
    'Teklif gönderildi':'Offer sent','TEKNİK SERVİS':'TECHNICAL SERVICE','Tek seçim':'Single choice',
    'Telefon belirtilmemiş':'Phone not specified','telefon numarası':'phone number','Telefon numarası olan alıcı yok':'No recipient has a phone number',
    'Temsil ve ağırlama':'Representation and hospitality','Toplam brüt':'Total gross','Toplam gün':'Total days',
    'Toplantı konusu':'Meeting subject','Toplantı tarihi':'Meeting date','Toplu Kayıp':'Bulk Loss',
    'Transfer onaylandı':'Transfer approved','Transfer reddedilsin mi? Eşya gönderen departmanda kalır.':'Reject the transfer? The item will remain in the sending department.',
    'Tüm dönem':'All periods','Tüm işyerleri':'All workplaces','Tüm personel':'All employees','Tüm şirket':'Entire company',
    'Tüm türler':'All types','Tüm yıllar':'All years','TÜR':'TYPE','Ulaşılamadı':'Unreachable','Ulaşıldı':'Reached',
    'Ulaşım':'Transportation','Ünvan':'Title','Vardiya kayıtları alınamadı':'Could not retrieve shift records',
    'Yapılandırıldı':'Configured','Yapılandırılmadı':'Not configured','Yazılım Geliştirici':'Software Developer',
    'Yeni anket şablonu':'New survey template','Yeni başvuru':'New application','Yeni çalışan':'New employee',
    'Yeni DÖF Aç':'Open New CAPA','Yeni eğitim':'New training','Yeni kayıt':'New record','Yeni kullanıcı':'New user',
    'Yeni Make It Right şablonu':'New Make It Right template','Yeni sürüm yükle':'Upload new version',
    'YGG toplantı kayıtları, kararlar ve aksiyon takibi':'Management review meeting records, decisions, and action tracking',
    'yiyecek içecek':'food and beverage','Yiyecek İçecek':'Food and Beverage','Yıllık İzin Bakiyesi':'Annual Leave Balance',
    'Yönetici · Düzenleme':'Manager · Edit','Yükleme başarısız: ':'Upload failed: ','Yürürlük':'In effect','Yürürlük tarihi':'Effective date',
    'Y - Yıllık İzin':'Y - Annual Leave','Ziyaretçi, araç ve çalışan giriş/çıkış takibi':'Visitor, vehicle, and employee check-in/check-out tracking',
    'Ziyaretçiler':'Visitors','Ziyaretçinin Adı Soyadı':'Visitor Full Name',
    'Canlı veri kontrolü yapılamadı':'Could not perform live data check','Eğitim ve Kalite':'Training and Quality',
    'kapanış':'closing','Yükleniyor':'Loading',
  };

  const esc = s => String(s ?? '');

  function translateText(raw){
    const trimmed = raw.trim();
    if(!trimmed) return raw;
    const hit = TR_EN[trimmed];
    if(hit === undefined) return raw;
    const lead = raw.slice(0, raw.indexOf(trimmed));
    const trail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
    return lead + hit + trail;
  }

  const ATTR_LIST = ['placeholder','title','aria-label'];

  function walk(node){
    if(!node) return;
    if(node.nodeType === 3){ // text node
      if(node.data && node.data.trim()){
        const next = translateText(node.data);
        if(next !== node.data) node.data = next;
      }
      return;
    }
    if(node.nodeType !== 1) return; // element only beyond this point
    for(const attr of ATTR_LIST){
      if(node.hasAttribute && node.hasAttribute(attr)){
        const v = node.getAttribute(attr);
        const next = translateText(v);
        if(next !== v) node.setAttribute(attr, next);
      }
    }
    let child = node.firstChild;
    while(child){ walk(child); child = child.nextSibling; }
  }

  // Tek bir "pending" bayrağı yeterli değil: aynı mikro-görevde birden fazla
  // scheduleWalk() çağrısı (ör. bir innerHTML atamasının eklediği onlarca
  // kardeş düğüm) olduğunda yalnızca İLK çağrılan kök işlenip diğerleri
  // sessizce atlanıyordu — bu yüzden veri geldikten sonra yeniden çizilen
  // sayfalar (Genel Bakış dahil) çoğunlukla çevrilmeden kalıyordu.
  let pendingRoots = new Set();
  let flushScheduled = false;
  function scheduleWalk(root){
    pendingRoots.add(root || document.body);
    if(flushScheduled) return;
    flushScheduled = true;
    (window.queueMicrotask || (fn => setTimeout(fn, 0)))(() => {
      flushScheduled = false;
      const roots = pendingRoots;
      pendingRoots = new Set();
      roots.forEach(r => walk(r));
    });
  }

  let observer = null;
  function startObserving(){
    if(observer) return;
    observer = new MutationObserver(muts => {
      for(const m of muts){
        if(m.type === 'characterData'){ scheduleWalk(m.target.parentNode || document.body); continue; }
        if(m.type === 'attributes'){ walk(m.target); continue; }
        for(const node of m.addedNodes) scheduleWalk(node.nodeType === 1 || node.nodeType === 3 ? node : document.body);
      }
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTR_LIST });
  }
  function stopObserving(){
    if(observer){ observer.disconnect(); observer = null; }
  }

  function activate(){
    walk(document.body);
    startObserving();
  }

  const currentLang = () => { try{ return localStorage.getItem('ik_lang') || 'tr'; }catch{ return 'tr'; } };

  window.__ikSetLanguage = function(lang){
    try{ localStorage.setItem('ik_lang', lang === 'en' ? 'en' : 'tr'); }catch{}
    location.reload();
  };
  window.__ikCurrentLang = currentLang;

  const boot = () => { if(currentLang() === 'en') activate(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
