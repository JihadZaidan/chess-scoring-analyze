# Chess Analysis Intelligence - Deployment Guide for Hostinger

## 📋 Prerequisites
- Hostinger account with hosting plan
- Domain name (optional)
- Git installed on your local machine

## 🚀 Deployment Methods

### Method 1: Using Hostinger Website Builder (Recommended)

1. **Login to Hostinger**
   - Go to [Hostinger](https://www.hostinger.com/)
   - Login to your account

2. **Create New Website**
   - Go to "Websites" → "Add Website"
   - Choose "Website Builder" or "Static Website"
   - Select your domain or use temporary domain

3. **Upload Files**
   - Build your project locally: `npm run build`
   - Upload the contents of the `out` folder to Hostinger
   - Or use Hostinger's Git integration

### Method 2: Using Hostinger VPS

1. **Setup VPS**
   - Get VPS from Hostinger
   - Connect via SSH
   - Install Node.js and npm

2. **Deploy Commands**
   ```bash
   # Clone repository
   git clone https://github.com/JihadZaidan/chess-scoring-analyze.git
   cd chess-scoring-analyze
   
   # Install dependencies
   npm install
   
   # Build for production
   npm run build
   
   # Serve static files (using nginx or serve)
   npm install -g serve
   serve -s out -l 3000
   ```

### Method 3: Using Hostinger Cloud Hosting

1. **Setup Cloud Hosting**
   - Choose Cloud Hosting plan
   - Access hPanel
   - Go to "File Manager"

2. **Upload Build Files**
   - Build locally: `npm run build`
   - Upload `out` folder contents to `public_html`
   - Ensure `.htaccess` is configured for SPA

## 🔧 Configuration Files

### .htaccess (for Apache servers)
```apache
RewriteEngine On
RewriteBase /chess-scoring-analyze/
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /chess-scoring-analyze/index.html [L]
```

### nginx.conf (for nginx servers)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/html/chess-scoring-analyze;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /chess-scoring-analyze/ {
        alias /var/www/html/chess-scoring-analyze/;
        try_files $uri $uri/ /chess-scoring-analyze/index.html;
    }
}
```

## 📦 Build Process

1. **Build for Production**
   ```bash
   npm run build
   ```

2. **Output Location**
   - Static files will be in `out/` folder
   - Upload this folder to your hosting

3. **Test Locally**
   ```bash
   npm install -g serve
   serve -s out -l 3000
   ```

## 🌐 Environment Variables

Create `.env.production` file:
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

## 🔍 Troubleshooting

### Common Issues:

1. **404 Errors on Refresh**
   - Ensure proper `.htaccess` or nginx configuration
   - Check base path in `next.config.ts`

2. **Static Assets Not Loading**
   - Verify `assetPrefix` configuration
   - Check file permissions on server

3. **Chess Board Not Loading**
   - Ensure all JavaScript files are uploaded
   - Check browser console for errors

### Debug Steps:

1. Check browser console for errors
2. Verify all files are uploaded correctly
3. Test with different browsers
4. Check server logs

## 📱 Mobile Optimization

The application is fully responsive and includes:
- Mobile-first design
- Touch-friendly interface
- Optimized for tablets and phones
- Chat toggle functionality for mobile

## 🚀 Final Steps

1. **Deploy files to Hostinger**
2. **Test all functionality**
3. **Set up SSL certificate**
4. **Configure domain (if applicable)**
5. **Monitor performance**

## 📞 Support

If you encounter issues:
- Check Hostinger documentation
- Verify file permissions
- Test with different browsers
- Contact Hostinger support

---

**Note**: This application is a static site and doesn't require server-side processing, making it ideal for Hostinger's shared hosting plans.
