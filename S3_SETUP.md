# Amazon S3 Setup Instructions

This guide will walk you through setting up an Amazon S3 bucket for the P2P file transfer application.

## Prerequisites

- An AWS account (sign up at https://aws.amazon.com/)
- Basic familiarity with AWS Console

## Step 1: Create an S3 Bucket

1. **Log in to AWS Console**
   - Go to https://console.aws.amazon.com/
   - Sign in with your AWS account credentials

2. **Navigate to S3**
   - In the AWS Console, search for "S3" in the services search bar
   - Click on "S3" to open the S3 dashboard

3. **Create a New Bucket**
   - Click the "Create bucket" button
   - **Bucket name**: Choose a unique name (e.g., `p2p-file-transfer-{your-name}`)
     - Note: S3 bucket names must be globally unique across all AWS accounts
   - **AWS Region**: Select a region close to your users (e.g., `us-east-1`, `us-west-2`, `eu-west-1`)
     - **Important**: Remember this region, you'll need it for configuration
   - **Object Ownership**: Select "ACLs disabled (recommended)"
   - **Block Public Access settings**: 
     - Uncheck "Block all public access" (we'll use presigned URLs, but the bucket itself won't be public)
     - Actually, keep it checked - we'll use presigned URLs which don't require public access
   - **Bucket Versioning**: Leave disabled (unless you need versioning)
   - **Default encryption**: Enable "Server-side encryption" with "Amazon S3 managed keys (SSE-S3)"
   - Click "Create bucket"

## Step 2: Create an IAM User for S3 Access

1. **Navigate to IAM**
   - In the AWS Console, search for "IAM" in the services search bar
   - Click on "IAM" to open the IAM dashboard

2. **Create a New User**
   - Click "Users" in the left sidebar
   - Click "Create user"
   - **User name**: Enter a name (e.g., `p2p-s3-user`)
   - Click "Next"

3. **Set Permissions**
   - Select "Attach policies directly"
   - Click "Create policy"
   - In the policy editor:
     - Click "JSON" tab
     - Paste the following policy (replace `YOUR_BUCKET_NAME` with your actual bucket name):
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "s3:PutObject",
             "s3:GetObject",
             "s3:DeleteObject"
           ],
           "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
         },
         {
           "Effect": "Allow",
           "Action": [
             "s3:ListBucket"
           ],
           "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
         }
       ]
     }
     ```
   - Click "Next"
   - **Policy name**: Enter a name (e.g., `p2p-s3-policy`)
   - Click "Create policy"
   - Go back to the user creation page and refresh
   - Select the policy you just created
   - Click "Next"
   - Review and click "Create user"

4. **Create Access Keys**
   - Click on the user you just created
   - Go to the "Security credentials" tab
   - Scroll down to "Access keys"
   - Click "Create access key"
   - Select "Application running outside AWS" as the use case
   - Click "Next"
   - Optionally add a description tag
   - Click "Create access key"
   - **IMPORTANT**: Copy both the **Access Key ID** and **Secret Access Key**
     - You won't be able to see the secret key again after closing this window
     - Store these securely (you'll need them for the `.env` file)

## Step 3: Configure Your Application

1. **Create a `.env` file in the `server/` directory**
   ```bash
   cd server
   touch .env
   ```

2. **Add the following environment variables to `.env`**:
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key_id_here
   AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
   AWS_S3_BUCKET_NAME=your_bucket_name_here
   PORT=3000
   ```
   - Replace `us-east-1` with the region you selected
   - Replace `your_access_key_id_here` with your Access Key ID
   - Replace `your_secret_access_key_here` with your Secret Access Key
   - Replace `your_bucket_name_here` with your bucket name

3. **Important Security Notes**:
   - Never commit the `.env` file to version control
   - Add `.env` to your `.gitignore` file
   - Keep your access keys secure and rotate them periodically

## Step 4: Test the Setup

1. **Install dependencies** (if not already done):
   ```bash
   cd server
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Test the upload endpoint** (using curl or Postman):
   ```bash
   curl -X POST http://localhost:3000/api/upload \
     -F "file=@/path/to/test/file.txt"
   ```

   You should receive a JSON response with a `downloadUrl` if successful.

## Troubleshooting

### Common Issues:

1. **"Access Denied" errors**
   - Verify your IAM user has the correct permissions
   - Check that the bucket name in the policy matches your actual bucket name
   - Ensure the access keys are correct

2. **"Bucket does not exist" errors**
   - Verify the bucket name in your `.env` file
   - Check that you're using the correct AWS region

3. **"Invalid credentials" errors**
   - Verify your Access Key ID and Secret Access Key are correct
   - Ensure there are no extra spaces in your `.env` file

## Cost Considerations

- **S3 Storage**: First 5 GB free per month, then $0.023 per GB/month (varies by region)
- **PUT Requests**: First 2,000 requests free per month, then $0.005 per 1,000 requests
- **GET Requests**: First 20,000 requests free per month, then $0.0004 per 1,000 requests
- **Data Transfer Out**: First 100 GB free per month, then varies by region

For most small to medium applications, costs should be minimal. Monitor your usage in the AWS Cost Explorer.

## Next Steps

Once your S3 bucket is configured, proceed to the EC2 deployment instructions to deploy your application.

