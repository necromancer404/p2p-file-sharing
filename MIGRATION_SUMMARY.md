# Migration Summary: Google Drive to Amazon S3

This document summarizes the changes made to migrate the P2P file transfer application from Google Drive to Amazon S3.

## Changes Made

### 1. Server Updates (`server/index.js`)
- ✅ Added AWS S3 SDK integration (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- ✅ Added multer for file upload handling
- ✅ Created `/api/upload` endpoint for uploading files to S3
- ✅ Created `/api/generate-url` endpoint for generating presigned download URLs
- ✅ Files are stored in S3 with structure: `uploads/{fileId}/{fileName}`
- ✅ Presigned URLs are valid for 7 days

### 2. Frontend Updates (`frontend/frontend/src/App.jsx`)
- ✅ Removed all Google Drive authentication code
- ✅ Removed Google Identity Services integration
- ✅ Replaced `uploadToGoogleDrive()` with `uploadToS3()`
- ✅ Updated UI to show "Upload to S3" instead of "Upload to Google Drive"
- ✅ Changed color scheme from Google green (#34a853) to AWS orange (#ff9900)
- ✅ Simplified state management (removed Google Drive auth states)

### 3. Configuration Updates
- ✅ Updated `frontend/frontend/src/config.js` to use `S3_CONFIG` instead of `GOOGLE_DRIVE_CONFIG`
- ✅ Removed Google API script from `frontend/frontend/index.html`

### 4. Dependencies
- ✅ Updated `server/package.json` with:
  - `@aws-sdk/client-s3`: ^3.490.0
  - `@aws-sdk/s3-request-presigner`: ^3.490.0
  - `multer`: ^1.4.5-lts.1

### 5. Documentation
- ✅ Created `S3_SETUP.md` - Complete guide for setting up Amazon S3
- ✅ Created `EC2_DEPLOYMENT.md` - Complete guide for deploying on EC2

## Environment Variables Required

Create a `.env` file in the `server/` directory with:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=your_bucket_name_here
PORT=3000
```

## Next Steps

1. **Set up S3** (follow `S3_SETUP.md`):
   - Create an S3 bucket
   - Create an IAM user with S3 permissions
   - Get access keys
   - Configure `.env` file

2. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Test locally**:
   ```bash
   npm start
   ```

4. **Deploy to EC2** (follow `EC2_DEPLOYMENT.md`):
   - Launch EC2 instance
   - Install Node.js, PM2, Nginx
   - Deploy application
   - Configure Nginx

## Key Differences from Google Drive

| Feature | Google Drive | Amazon S3 |
|---------|-------------|-----------|
| Authentication | OAuth 2.0 (client-side) | IAM credentials (server-side) |
| Upload Method | Direct client upload | Server proxy upload |
| Security | OAuth tokens | Presigned URLs |
| File Access | Public sharing links | Time-limited presigned URLs |
| Setup Complexity | Medium (OAuth setup) | Medium (IAM setup) |

## Benefits of S3 Migration

1. **Better Security**: Credentials stored server-side, not exposed to clients
2. **More Control**: Fine-grained IAM permissions
3. **Cost Effective**: Pay only for what you use
4. **Scalable**: S3 handles large files and high traffic
5. **Presigned URLs**: Time-limited, secure download links
6. **No OAuth Flow**: Simpler user experience (no authentication popups)

## Testing Checklist

- [ ] S3 bucket created and configured
- [ ] IAM user created with proper permissions
- [ ] `.env` file configured with credentials
- [ ] Server dependencies installed
- [ ] Server starts without errors
- [ ] `/api/upload` endpoint works
- [ ] Frontend can upload files to S3
- [ ] Presigned URLs are generated correctly
- [ ] Download links work and expire after 7 days
- [ ] P2P transfer still works as fallback

## Troubleshooting

If you encounter issues:

1. **Check server logs**: `pm2 logs p2p-server` (on EC2) or console output (locally)
2. **Verify S3 credentials**: Ensure `.env` file has correct values
3. **Check S3 bucket permissions**: IAM user must have PutObject and GetObject permissions
4. **Verify network**: Ensure EC2 security group allows traffic on port 3000
5. **Check CORS**: S3 bucket CORS settings (if accessing directly from browser)

For detailed troubleshooting, see `S3_SETUP.md` and `EC2_DEPLOYMENT.md`.

