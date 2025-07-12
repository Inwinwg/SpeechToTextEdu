#!/usr/bin/env python3
"""
HTTPS Server for Speech Comparison Tool
This script creates a self-signed certificate and serves files over HTTPS on localhost
"""

import os
import ssl
import socket
import ipaddress
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timedelta, timezone

def create_self_signed_cert():
    """Create a self-signed certificate for localhost"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # Create certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Local"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Localhost"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Speech Tool"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.now(timezone.utc)
        ).not_valid_after(
            datetime.now(timezone.utc) + timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())
        
        # Write certificate and private key
        with open("cert.pem", "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        with open("key.pem", "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        return True
    except ImportError:
        print("cryptography library not found. Using OpenSSL method...")
        return False

def create_cert_with_openssl():
    """Create certificate using OpenSSL if available"""
    try:
        import subprocess
        # Generate private key
        subprocess.run([
            "openssl", "genrsa", "-out", "key.pem", "2048"
        ], check=True, capture_output=True)
        
        # Generate certificate
        subprocess.run([
            "openssl", "req", "-new", "-x509", "-key", "key.pem", 
            "-out", "cert.pem", "-days", "365", "-subj",
            "/C=US/ST=Local/L=Localhost/O=Speech Tool/CN=localhost"
        ], check=True, capture_output=True)
        
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def main():
    print("🚀 Starting HTTPS Server for Speech Comparison Tool")
    print("=" * 50)
    
    # Check if certificate files exist
    cert_file = "cert.pem"
    key_file = "key.pem"
    
    if not (os.path.exists(cert_file) and os.path.exists(key_file)):
        print("📜 Creating self-signed certificate...")
        
        # Try cryptography library first
        if not create_self_signed_cert():
            # Fallback to OpenSSL
            if not create_cert_with_openssl():
                print("❌ Could not create certificate. Please install cryptography:")
                print("   pip install cryptography")
                print("   OR install OpenSSL and ensure 'openssl' command is available")
                return
        
        print("✅ Certificate created successfully!")
    
    # Create HTTPS server
    server_address = ('localhost', 8443)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    
    # Wrap with SSL
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert_file, key_file)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print(f"🌐 HTTPS Server running at: https://localhost:8443")
    print(f"📁 Serving files from: {os.getcwd()}")
    print("\n📋 Available pages:")
    print("   • Landing page: https://localhost:8443/")
    print("   • Teacher dashboard: https://localhost:8443/teacher.html")
    print("   • Student practice: https://localhost:8443/student.html")
    print("\n⚠️  Note: You may see a security warning in your browser.")
    print("   Click 'Advanced' and 'Proceed to localhost' to continue.")
    print("\n🛑 Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped.")
        httpd.server_close()

if __name__ == "__main__":
    main() 