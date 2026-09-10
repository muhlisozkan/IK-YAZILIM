FROM nginx:1.27-alpine
COPY index.html anket.html styles.css auth.js server-store.js app.js combobox.js enhancements.js navigation-fix.js mobile-nav.js leave-enhancements.js attendance.js attendance-paged.js attendance-controls.js approval.js payroll-enhancements.js users.js permissions.js departments.js expense-advance.js shifts.js reports-enhancements.js notifications.js documents.js recruitment.js performance.js training.js training-dept.js employee-details.js hms.js survey.js personel-butcesi.js guncel-tablo.js dashboard.js /usr/share/nginx/html/
COPY fonts /usr/share/nginx/html/fonts
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
