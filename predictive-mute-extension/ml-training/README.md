# ML Training Directory

This directory contains the training scripts for the ONNX intent classification model.

## Files

- `train_intent_model.py` - Fine-tunes MiniLM-L6 for leak-intent detection
- `convert_to_onnx.py` - Converts PyTorch model to ONNX format
- `requirements.txt` - Python dependencies

## Generated Directories (Not in Git)

These directories are created when you run the training scripts and are **NOT** committed to git due to their large size (100-200 MB total):

- `fine-tuned-intent-model/` - PyTorch model checkpoint (created by train_intent_model.py)
- `intent-model-checkpoints/` - Training checkpoints (created during training)
- `onnx-models/` - Intermediate ONNX files (created by convert_to_onnx.py)

The final quantized model is automatically copied to `../models/intent_classifier.onnx` (~22MB) which **IS** included in git.

## Usage

```bash
# Install dependencies
pip install -r requirements.txt

# Train model
python3 train_intent_model.py

# Convert to ONNX
python3 convert_to_onnx.py
```

## Why These Files Are Not in Git

The intermediate training files are too large for GitHub (>100MB). Each user should:
1. Run the training scripts locally
2. The final model will be copied to `models/` directory automatically

The small quantized model in `models/` is what the extension actually uses.
