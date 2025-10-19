#!/usr/bin/env python3
"""
Convert the fine-tuned intent model to ONNX format for browser deployment.

This script:
1. Loads the fine-tuned PyTorch model
2. Exports to ONNX format
3. Quantizes to INT8 for 4x smaller size
4. Prepares tokenizer vocab for JavaScript

Usage:
    python convert_to_onnx.py

Requirements:
    pip install optimum onnx onnxruntime
"""

import json
import torch
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from optimum.onnxruntime import ORTModelForSequenceClassification
from onnxruntime.quantization import quantize_dynamic, QuantType
import shutil

# ============================================================================
# CONFIG
# ============================================================================

INPUT_MODEL_DIR = './fine-tuned-intent-model'
OUTPUT_DIR = './onnx-models'
EXTENSION_MODELS_DIR = '../models'  # Chrome extension models folder

# ============================================================================
# LOAD MODEL
# ============================================================================

print("="*80)
print("CONVERTING MODEL TO ONNX")
print("="*80 + "\n")

print(f"Loading model from: {INPUT_MODEL_DIR}")

tokenizer = AutoTokenizer.from_pretrained(INPUT_MODEL_DIR)
model = AutoModelForSequenceClassification.from_pretrained(INPUT_MODEL_DIR)

# ============================================================================
# EXPORT TO ONNX
# ============================================================================

print("\n[1/4] Exporting to ONNX format...")

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

ort_model = ORTModelForSequenceClassification.from_pretrained(
    INPUT_MODEL_DIR,
    export=True,
)

ort_model.save_pretrained(OUTPUT_DIR)

original_onnx_path = Path(OUTPUT_DIR) / "model.onnx"
print(f"  ✓ ONNX model exported: {original_onnx_path}")

# Get file size
original_size = original_onnx_path.stat().st_size / (1024 * 1024)
print(f"  Size: {original_size:.2f} MB")

# ============================================================================
# QUANTIZE TO INT8
# ============================================================================

print("\n[2/4] Quantizing to INT8...")

quantized_onnx_path = Path(OUTPUT_DIR) / "model_quantized.onnx"

quantize_dynamic(
    str(original_onnx_path),
    str(quantized_onnx_path),
    weight_type=QuantType.QUInt8
)

quantized_size = quantized_onnx_path.stat().st_size / (1024 * 1024)
print(f"  ✓ Quantized model: {quantized_onnx_path}")
print(f"  Size: {quantized_size:.2f} MB ({quantized_size/original_size*100:.1f}% of original)")

# ============================================================================
# EXPORT TOKENIZER VOCAB
# ============================================================================

print("\n[3/4] Exporting tokenizer vocabulary...")

vocab = tokenizer.get_vocab()

# Save as JSON for JavaScript
vocab_path = Path(OUTPUT_DIR) / "vocab.json"
with open(vocab_path, 'w') as f:
    json.dump(vocab, f, indent=2)

print(f"  ✓ Vocabulary exported: {vocab_path}")
print(f"  Vocab size: {len(vocab)} tokens")

# Save tokenizer config
tokenizer_config = {
    'max_length': 32,
    'padding': 'max_length',
    'truncation': True,
    'pad_token': tokenizer.pad_token,
    'unk_token': tokenizer.unk_token,
    'sep_token': tokenizer.sep_token,
    'cls_token': tokenizer.cls_token,
    'pad_token_id': tokenizer.pad_token_id,
    'unk_token_id': tokenizer.unk_token_id,
    'sep_token_id': tokenizer.sep_token_id,
    'cls_token_id': tokenizer.cls_token_id,
}

config_path = Path(OUTPUT_DIR) / "tokenizer_config.json"
with open(config_path, 'w') as f:
    json.dump(tokenizer_config, f, indent=2)

print(f"  ✓ Tokenizer config: {config_path}")

# ============================================================================
# COPY TO EXTENSION
# ============================================================================

print(f"\n[4/4] Copying to Chrome extension...")

extension_models_path = Path(EXTENSION_MODELS_DIR)
extension_models_path.mkdir(parents=True, exist_ok=True)

# Copy quantized model
shutil.copy(quantized_onnx_path, extension_models_path / "intent_classifier.onnx")
print(f"  ✓ Copied to: {extension_models_path / 'intent_classifier.onnx'}")

# Copy vocab
shutil.copy(vocab_path, extension_models_path / "vocab.json")
print(f"  ✓ Copied to: {extension_models_path / 'vocab.json'}")

# Copy tokenizer config
shutil.copy(config_path, extension_models_path / "tokenizer_config.json")
print(f"  ✓ Copied to: {extension_models_path / 'tokenizer_config.json'}")

# ============================================================================
# SUMMARY
# ============================================================================

print("\n" + "="*80)
print("CONVERSION COMPLETE")
print("="*80 + "\n")

print("Files created:")
print(f"  1. {extension_models_path / 'intent_classifier.onnx'} ({quantized_size:.2f} MB)")
print(f"  2. {extension_models_path / 'vocab.json'}")
print(f"  3. {extension_models_path / 'tokenizer_config.json'}")

print("\nNext steps:")
print("  1. Install onnxruntime-web: cd .. && npm install onnxruntime-web")
print("  2. Update manifest.json to include model files")
print("  3. Load extension in Chrome")

print("\n✓ Ready for browser deployment!")
