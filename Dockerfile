FROM nginx:1.27-alpine
COPY index.html styles.css auth.js server-store.js app.js enhancements.js navigation-fix.js leave-enhancements.js attendance.js attendance-paged.js attendance-controls.js approval.js payroll-enhancements.js users.js permissions.js departments.js expense-advance.js shifts.js reports-enhancements.js notifications.js documents.js recruitment.js recruitment-dept.js performance.js training.js training-dept.js employee-details.js dashboard.js /usr/share/nginx/html/
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
