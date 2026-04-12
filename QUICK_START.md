# Quick Start Guide

Get your P2P file transfer application running with Amazon S3 in minutes!

## Prerequisites Checklist

- [ ] AWS Account created
- [ ] Node.js installed (v18+)
- [ ] Git installed (for deployment)

## Step 1: Set Up S3 (5-10 minutes)

Follow the detailed guide in `S3_SETUP.md`, or quick steps:

1. **Create S3 Bucket**:
   - AWS Console → S3 → Create bucket
   - Choose unique name and region
   - Note the bucket name and region

2. **Create IAM User**:
   - AWS Console → IAM → Users → Create user
   - Attach policy with S3 PutObject/GetObject permissions
   - Create access keys
   - **Save Access Key ID and Secret Access Key**

3. **Configure Server**:
   ```bash
   cd server
   # Create .env file
   nano .env
   ```
   
   Add:
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_here
   AWS_S3_BUCKET_NAME=your_bucket_name
   PORT=3000
   ```

## Step 2: Install Dependencies

```bash
# Server dependencies
cd server
npm install

# Frontend dependencies
cd ../frontend/frontend
npm install
```

## Step 3: Run Locally

**Terminal 1 - Start Server**:
```bash
cd server
npm start
```

**Terminal 2 - Start Frontend**:
```bash
cd frontend/frontend
npm run dev
```

Open `http://localhost:5173` (or the port Vite shows) in your browser.

## Step 4: Test

1. Click "Send"
2. Select a file
3. Click "Upload to S3"
4. Wait for upload to complete
5. Copy the download link
6. Test the link in a new browser/incognito window

## Step 5: Deploy to EC2 (Optional)

Follow the complete guide in `EC2_DEPLOYMENT.md` for production deployment.

## Common Issues

**"Access Denied" error**:
- Check IAM user has S3 permissions
- Verify bucket name in `.env` matches actual bucket
- Ensure access keys are correct

**"Bucket does not exist"**:
- Verify bucket name (case-sensitive)
- Check AWS region matches

**Server won't start**:
- Check `.env` file exists and has all required variables
- Run `npm install` in server directory
- Check port 3000 is not in use

## Need Help?

- **S3 Setup**: See `S3_SETUP.md`
- **EC2 Deployment**: See `EC2_DEPLOYMENT.md`
- **Migration Details**: See `MIGRATION_SUMMARY.md`

## Next Steps

- [ ] Test file uploads
- [ ] Test P2P transfer (fallback)
- [ ] Deploy to EC2 for production
- [ ] Set up domain name and SSL
- [ ] Configure monitoring

