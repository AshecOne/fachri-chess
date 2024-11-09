import torch
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
import chess
import numpy as np
from train_model import ChessModel  # Pastikan file train_model.py ada

def convert_to_onnx():
    # Load model PyTorch
    model = ChessModel()
    model.load_state_dict(torch.load('public/chess_model.pt', map_location='cpu', weights_only=True))
    model.eval()

    # Create dummy input with correct size (896 features)
    dummy_input = torch.randn(1, 896)

    # Export ke ONNX
    torch.onnx.export(
        model,
        dummy_input,
        'public/chess_model.onnx',
        export_params=True,
        opset_version=12,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'output': {0: 'batch_size'}
        }
    )
    
    # Quantize model
    model_path = 'public/chess_model.onnx'
    quantized_model_path = 'public/chess_model_quantized.onnx'
    
    try:
        # Quantize dengan preprocessing
        from onnxruntime.quantization.preprocess import PreprocessModel
        from onnxruntime.quantization.calibrate import CalibrationDataReader

        # Optional: Preprocessing step
        preprocessed_model_path = 'public/chess_model_preprocessed.onnx'
        PreprocessModel(model_path, preprocessed_model_path)
        
        # Quantize using the correct QuantType
        quantize_dynamic(
            model_input=preprocessed_model_path,
            model_output=quantized_model_path,
            weight_type=QuantType.QInt8  # Use QuantType instead of np.int8
        )
        print("Model quantized successfully!")
        
        # Verify the quantized model
        quantized_model = onnx.load(quantized_model_path)
        onnx.checker.check_model(quantized_model)
        print("Quantized model verified successfully!")
        
    except Exception as e:
        print(f"Error during quantization: {str(e)}")
        print("Saving non-quantized model only...")
        import shutil
        shutil.copy(model_path, quantized_model_path)

if __name__ == "__main__":
    convert_to_onnx()