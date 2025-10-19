#!/bin/bash

# Predictive Mute Extension - Automated Setup Script
# Installs dependencies, trains model, and prepares for deployment

set -e  # Exit on error

echo "======================================================================"
echo "  Predictive Mute Extension - ONNX Model Setup"
echo "======================================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    print_error "manifest.json not found. Please run this script from the predictive-mute-extension directory."
    exit 1
fi

print_success "Found manifest.json"
echo ""

# Step 1: Check prerequisites
print_info "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 16+ from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node --version)
print_success "Node.js installed: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm"
    exit 1
fi
NPM_VERSION=$(npm --version)
print_success "npm installed: $NPM_VERSION"

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Please install Python 3.8+ from https://python.org"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
print_success "Python installed: $PYTHON_VERSION"

# Check pip
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    print_error "pip not found. Please install pip"
    exit 1
fi
print_success "pip installed"

echo ""

# Step 2: Install JavaScript dependencies
print_info "Installing JavaScript dependencies..."
npm install
print_success "npm packages installed"
echo ""

# Step 3: Install Python dependencies
print_info "Installing Python dependencies..."
cd ml-training

if [ -f "requirements.txt" ]; then
    if command -v pip3 &> /dev/null; then
        pip3 install -r requirements.txt
    else
        pip install -r requirements.txt
    fi
    print_success "Python packages installed"
else
    print_error "requirements.txt not found in ml-training/"
    exit 1
fi

cd ..
echo ""

# Step 4: Train the model
print_info "Training intent classification model..."
print_info "This may take 5-10 minutes depending on your hardware..."
echo ""

cd ml-training
python3 train_intent_model.py

if [ $? -eq 0 ]; then
    print_success "Model training completed"
else
    print_error "Model training failed. Check the output above for errors."
    exit 1
fi
cd ..
echo ""

# Step 5: Convert to ONNX
print_info "Converting model to ONNX format..."
echo ""

cd ml-training
python3 convert_to_onnx.py

if [ $? -eq 0 ]; then
    print_success "ONNX conversion completed"
else
    print_error "ONNX conversion failed. Check the output above for errors."
    exit 1
fi
cd ..
echo ""

# Step 6: Verify model files
print_info "Verifying model files..."

if [ ! -d "models" ]; then
    print_error "models/ directory not found"
    exit 1
fi

REQUIRED_FILES=("intent_classifier.onnx" "vocab.json" "tokenizer_config.json")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "models/$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    print_success "All model files present:"
    echo "  - models/intent_classifier.onnx ($(du -h models/intent_classifier.onnx | cut -f1))"
    echo "  - models/vocab.json ($(du -h models/vocab.json | cut -f1))"
    echo "  - models/tokenizer_config.json ($(du -h models/tokenizer_config.json | cut -f1))"
else
    print_error "Missing model files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

echo ""

# Step 7: Summary
echo "======================================================================"
echo "  Setup Complete!"
echo "======================================================================"
echo ""
print_success "Extension is ready to use!"
echo ""
echo "Next steps:"
echo "  1. Open Chrome and go to chrome://extensions/"
echo "  2. Enable 'Developer mode' (top-right toggle)"
echo "  3. Click 'Load unpacked'"
echo "  4. Select this directory: $(pwd)"
echo "  5. Join a Google Meet or Zoom call to test"
echo ""
echo "Documentation:"
echo "  - Quick Start: QUICK_START.md"
echo "  - Full Guide: README_ML_SETUP.md"
echo "  - Summary: IMPLEMENTATION_SUMMARY.md"
echo ""
echo "Testing:"
echo "  Try saying: 'let me tell you my password' → Should mute"
echo "  Try saying: 'let me tell you about my day' → Should NOT mute"
echo ""
print_success "Happy muting!"
echo ""
