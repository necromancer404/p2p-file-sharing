# EC2 Deployment Instructions

This guide will walk you through deploying the P2P file transfer application on an Amazon EC2 instance.

## Prerequisites

- An AWS account with S3 already configured (see `S3_SETUP.md`)
- Basic familiarity with Linux command line
- SSH client installed on your local machine

## Step 1: Launch an EC2 Instance

1. **Navigate to EC2**
   - Go to https://console.aws.amazon.com/ec2/
   - Click "Launch Instance"

2. **Configure Instance**
   - **Name**: `p2p-file-transfer-server`
   - **Application and OS Images (Amazon Machine Image)**: 
     - Select "Ubuntu Server 22.04 LTS" (or latest LTS version)
   - **Instance type**: 
     - For testing: `t2.micro` (free tier eligible)
     - For production: `t2.small` or `t3.small` (better performance)
   - **Key pair (login)**: 
     - Click "Create new key pair"
     - Name: `p2p-server-key`
     - Key pair type: RSA
     - Private key file format: `.pem` (for Linux/Mac) or `.ppk` (for Windows with PuTTY)
     - Click "Create key pair"
     - **IMPORTANT**: Download and save the key file securely - you'll need it to SSH into the instance
   - **Network settings**:
     - Allow SSH traffic from: "My IP" (or "Anywhere" for testing, but less secure)
     - Click "Add security group rule":
       - Type: Custom TCP
       - Port: 3000
       - Source: "Anywhere-IPv4" (or "My IP" for more security)
       - Description: "P2P signaling server"
     - Click "Add security group rule" again:
       - Type: Custom TCP
       - Port: 80
       - Source: "Anywhere-IPv4"
       - Description: "HTTP for frontend"
     - Click "Add security group rule" again:
       - Type: Custom TCP
       - Port: 443
       - Source: "Anywhere-IPv4"
       - Description: "HTTPS for frontend"
   - **Configure storage**: 
     - 8 GB gp3 (free tier) or more as needed
   - Click "Launch instance"

3. **Wait for Instance to Start**
   - Click "View all instances"
   - Wait for the instance state to show "Running" (takes 1-2 minutes)
   - Note the **Public IPv4 address** - you'll need this

## Step 2: Connect to Your EC2 Instance

### For Linux/Mac:

```bash
# Make sure your key file has correct permissions
chmod 400 p2p-server-key.pem

# Connect to the instance (replace with your instance IP)
ssh -i p2p-server-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### For Windows (using PuTTY):

1. Download and install PuTTY
2. Convert `.pem` to `.ppk` using PuTTYgen (if needed)
3. Open PuTTY
4. Enter hostname: `ubuntu@YOUR_EC2_PUBLIC_IP`
5. In Connection > SSH > Auth, browse to your `.ppk` key file
6. Click "Open" to connect

## Step 3: Install Required Software on EC2

Once connected to your EC2 instance, run the following commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource repository for latest LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install PM2 (process manager for Node.js)
sudo npm install -g pm2

# Install Nginx (web server for frontend)
sudo apt install -y nginx

# Install Git (if not already installed)
sudo apt install -y git
```

## Step 4: Clone and Setup Your Application

```bash
# Navigate to home directory
cd ~

# Clone your repository (replace with your repo URL)
# If using GitHub:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git p2p-app
cd p2p-app

# Or if you need to upload files manually, create the directory structure:
# mkdir -p p2p-app/server p2p-app/frontend/frontend
# Then use SCP to upload your files
```

## Step 5: Configure the Server

```bash
# Navigate to server directory
cd server

# Install server dependencies
npm install

# Create .env file
nano .env
```

Add the following to the `.env` file (press `Ctrl+X`, then `Y`, then `Enter` to save):

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=your_bucket_name_here
PORT=3000
```

**Important**: Replace the values with your actual S3 credentials from the S3 setup.

## Step 6: Start the Server with PM2

```bash
# Start the server with PM2
pm2 start index.js --name p2p-server

# Save PM2 configuration to restart on reboot
pm2 save
pm2 startup

# Check server status
pm2 status
pm2 logs p2p-server
```

## Step 7: Build and Deploy the Frontend

```bash
# Navigate to frontend directory
cd ~/p2p-app/frontend/frontend

# Install frontend dependencies
npm install

# Create .env file for frontend (optional, or update config.js)
echo "VITE_SIGNALING_SERVER=http://YOUR_EC2_PUBLIC_IP:3000" > .env

# Build the frontend
npm run build

# The build output will be in the dist/ directory
```

## Step 8: Configure Nginx for Frontend

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/p2p-app
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;

    root /home/ubuntu/p2p-app/frontend/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js server
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy Socket.IO requests
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Save and exit, then:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/p2p-app /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx
```

## Step 9: Update Security Group (if needed)

If you need to allow HTTP/HTTPS traffic:

1. Go to EC2 Console > Instances
2. Select your instance
3. Click "Security" tab
4. Click on the security group
5. Edit inbound rules to ensure ports 80 and 443 are open

## Step 10: Test Your Deployment

1. **Test the server**:
   ```bash
   curl http://localhost:3000
   # Should return: "P2P signaling server running"
   ```

2. **Test from your browser**:
   - Open `http://YOUR_EC2_PUBLIC_IP` in your browser
   - You should see the P2P file transfer interface

3. **Test file upload**:
   - Try uploading a file through the web interface
   - Check PM2 logs: `pm2 logs p2p-server`

## Step 11: (Optional) Set Up Domain Name and SSL

### Using a Domain Name:

1. **Point your domain to EC2**:
   - In your domain registrar, create an A record pointing to your EC2 public IP

2. **Install Certbot for SSL**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

3. **Get SSL Certificate**:
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

4. **Update Nginx config** to use your domain instead of IP

5. **Update frontend config** to use your domain

## Maintenance Commands

```bash
# View server logs
pm2 logs p2p-server

# Restart server
pm2 restart p2p-server

# Stop server
pm2 stop p2p-server

# View server status
pm2 status

# Update application
cd ~/p2p-app
git pull  # if using git
cd server
npm install
pm2 restart p2p-server

# Update frontend
cd ~/p2p-app/frontend/frontend
npm install
npm run build
sudo systemctl reload nginx
```

## Troubleshooting

### Server not starting:
```bash
# Check PM2 logs
pm2 logs p2p-server

# Check if port 3000 is in use
sudo netstat -tulpn | grep 3000

# Check environment variables
cd ~/p2p-app/server
cat .env
```

### Frontend not loading:
```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify build files exist
ls -la ~/p2p-app/frontend/frontend/dist
```

### Can't connect from browser:
- Verify security group allows traffic on ports 80, 443, and 3000
- Check EC2 instance is running
- Verify firewall rules (if any)

## Security Best Practices

1. **Keep system updated**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use IAM roles** (instead of access keys in .env):
   - Create an IAM role with S3 permissions
   - Attach the role to your EC2 instance
   - Remove AWS credentials from .env file
   - The AWS SDK will automatically use the instance role

3. **Set up firewall** (UFW):
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

4. **Regular backups**: Consider setting up automated backups of your application files

5. **Monitor costs**: Set up billing alerts in AWS Console

## Cost Estimation

- **EC2 t2.micro**: Free tier eligible (750 hours/month for first year)
- **EC2 t2.small**: ~$15-20/month
- **Data transfer**: First 1 GB free, then ~$0.09/GB
- **S3**: See S3_SETUP.md for pricing

## Next Steps

- Set up monitoring (CloudWatch)
- Configure automatic backups
- Set up CI/CD pipeline
- Add domain name and SSL certificate
- Configure log rotation

