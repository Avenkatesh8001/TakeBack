#!/usr/bin/env python3
"""
Train a lightweight intent classification model for predictive muting.

This script fine-tunes MiniLM-L6 on leak-intent detection.
Output: A binary classifier that predicts if speech is about to leak sensitive info.

Usage:
    python train_intent_model.py

Requirements:
    pip install transformers datasets torch accelerate
"""

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding
)
from datasets import Dataset
import numpy as np
import torch

# ============================================================================
# TRAINING DATA
# ============================================================================

# Positive examples: leak-intent (things that lead to sensitive disclosures)
POSITIVE_EXAMPLES = [
    # Credential precursors
    "let me tell you my password",
    "so my password is",
    "I'll share my credentials",
    "the login is",
    "my username and password are",
    "let me give you the API key",
    "the secret key is",
    "here's my access token",

    # Financial precursors
    "let me share my credit card",
    "so my card number is",
    "the CVV is",
    "my social security number is",
    "my SSN is",
    "let me tell you my bank account",
    "the routing number is",
    "my salary is around",
    "I make about",
    "my compensation is",

    # Business sensitive
    "our revenue for this quarter",
    "we're planning a merger with",
    "let me tell you about the layoffs",
    "the acquisition target is",
    "our profit margin is",
    "this is confidential but",
    "don't tell anyone but",
    "between you and me",
    "off the record",

    # Personal data
    "my address is",
    "I live at",
    "my phone number is",
    "you can reach me at",
    "my email is",
    "my date of birth is",

    # Augmented variations
    "um so my password is actually",
    "okay let me share the API key",
    "so yeah my social security",
    "I guess I can tell you my salary",
    "alright so the credit card number",
    "let me think, my password was",
]

# Negative examples: safe conversation
NEGATIVE_EXAMPLES = [
    # Normal meeting talk
    "let me tell you about my day",
    "so I think we should discuss",
    "can you hear me okay",
    "I'll share my screen now",
    "let me show you this slide",
    "what do you think about",
    "I agree with that point",
    "that sounds good to me",

    # General conversation
    "the weather is nice today",
    "how are you doing",
    "thanks for joining",
    "let's move to the next topic",
    "I have a question about",
    "could you explain that",
    "I understand what you mean",

    # Work-appropriate
    "our team meeting is at 3pm",
    "I'll send you an email",
    "we need to review the document",
    "let me check my calendar",
    "I'll follow up on that",
    "good point about the timeline",
    "we should prioritize this",
    "I'll take notes on this",

    # Filler/normal speech
    "um let me see",
    "okay so basically",
    "yeah I think so",
    "alright sounds good",
    "great thank you",
    "no problem",
    "sure thing",
    "got it thanks",

    # Project discussion
    "the project deadline is next week",
    "we're making good progress",
    "I've completed the analysis",
    "let me walk you through",
    "here's what I found",
    "the results show that",
    "we should consider",
    "my recommendation would be",

    # More safe examples
    "I'll look into that",
    "that makes sense",
    "let me get back to you",
    "I need to check on something",
    "we can discuss this later",
    "I'll prepare the report",
    "let's schedule a follow-up",
    "I appreciate your input",
]

# ============================================================================
# DATA AUGMENTATION
# ============================================================================

def augment_data(examples, labels):
    """Add variations to training data"""
    augmented_texts = []
    augmented_labels = []

    # Add original data
    augmented_texts.extend(examples)
    augmented_labels.extend(labels)

    # Add with filler words
    fillers = ["um", "uh", "so", "actually", "basically", "like", "you know", ""]

    for text, label in zip(examples, labels):
        for filler in fillers[:3]:  # Use subset to avoid explosion
            if filler:
                aug_text = f"{filler} {text}"
            else:
                aug_text = text

            # Don't duplicate exact originals
            if aug_text not in augmented_texts:
                augmented_texts.append(aug_text)
                augmented_labels.append(label)

    return augmented_texts, augmented_labels

# ============================================================================
# PREPARE DATASET
# ============================================================================

# Combine examples
all_texts = []
all_labels = []

# Add positives (label=1)
all_texts.extend(POSITIVE_EXAMPLES)
all_labels.extend([1] * len(POSITIVE_EXAMPLES))

# Add negatives (label=0)
all_texts.extend(NEGATIVE_EXAMPLES)
all_labels.extend([0] * len(NEGATIVE_EXAMPLES))

print(f"Original dataset: {len(all_texts)} samples")
print(f"  Positive (leak-intent): {sum(all_labels)}")
print(f"  Negative (safe): {len(all_labels) - sum(all_labels)}")

# Augment
all_texts, all_labels = augment_data(all_texts, all_labels)

print(f"After augmentation: {len(all_texts)} samples")

# Create dataset
dataset = Dataset.from_dict({
    'text': all_texts,
    'label': all_labels
})

# Split train/eval (80/20)
dataset = dataset.train_test_split(test_size=0.2, seed=42)

print(f"Train: {len(dataset['train'])}, Eval: {len(dataset['test'])}")

# ============================================================================
# LOAD MODEL
# ============================================================================

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

print(f"\nLoading model: {MODEL_NAME}")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=2,
    id2label={0: "SAFE", 1: "LEAK_INTENT"},
    label2id={"SAFE": 0, "LEAK_INTENT": 1}
)

# ============================================================================
# TOKENIZATION
# ============================================================================

def tokenize_function(examples):
    return tokenizer(
        examples['text'],
        truncation=True,
        padding='max_length',
        max_length=32  # Short sequences for speed
    )

tokenized_dataset = dataset.map(tokenize_function, batched=True)

data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

# ============================================================================
# METRICS
# ============================================================================

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)

    # Calculate accuracy
    accuracy = (predictions == labels).mean()

    # Calculate precision, recall, F1
    tp = ((predictions == 1) & (labels == 1)).sum()
    fp = ((predictions == 1) & (labels == 0)).sum()
    fn = ((predictions == 0) & (labels == 1)).sum()

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1
    }

# ============================================================================
# TRAINING
# ============================================================================

training_args = TrainingArguments(
    output_dir='./intent-model-checkpoints',
    num_train_epochs=20,  # More epochs for small dataset
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    learning_rate=3e-5,
    weight_decay=0.01,
    warmup_steps=20,
    logging_steps=10,
    eval_strategy='epoch',
    save_strategy='epoch',
    load_best_model_at_end=True,
    metric_for_best_model='f1',
    greater_is_better=True,
    save_total_limit=2,
    push_to_hub=False,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset['train'],
    eval_dataset=tokenized_dataset['test'],
    tokenizer=tokenizer,
    data_collator=data_collator,
    compute_metrics=compute_metrics,
)

print("\n" + "="*80)
print("STARTING TRAINING")
print("="*80 + "\n")

trainer.train()

# ============================================================================
# SAVE MODEL
# ============================================================================

output_dir = './fine-tuned-intent-model'
trainer.save_model(output_dir)
tokenizer.save_pretrained(output_dir)

print(f"\n✓ Model saved to: {output_dir}")

# ============================================================================
# EVALUATION
# ============================================================================

print("\n" + "="*80)
print("FINAL EVALUATION")
print("="*80 + "\n")

results = trainer.evaluate()

print("Metrics:")
for key, value in results.items():
    if not key.startswith('eval_'):
        continue
    metric_name = key.replace('eval_', '')
    print(f"  {metric_name}: {value:.4f}")

# ============================================================================
# TEST PREDICTIONS
# ============================================================================

print("\n" + "="*80)
print("TEST PREDICTIONS")
print("="*80 + "\n")

test_cases = [
    "let me tell you my password",
    "I think we should discuss the project",
    "my social security number is",
    "can you hear me okay",
    "so my API key is",
    "the weather looks nice today",
]

from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model=model,
    tokenizer=tokenizer,
    device=0 if torch.cuda.is_available() else -1
)

for text in test_cases:
    result = classifier(text)[0]
    print(f"Text: \"{text}\"")
    print(f"  → {result['label']} (confidence: {result['score']:.3f})")
    print()

print("✓ Training complete!")
print(f"\nNext steps:")
print(f"1. Run: python convert_to_onnx.py")
print(f"2. Copy models/ folder to your Chrome extension")
