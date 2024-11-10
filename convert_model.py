import torch
import onnx
from train_model import ChessModel

def convert_to_onnx():
    # Load model PyTorch
    model = ChessModel()
    model.load_state_dict(torch.load('public/chess_model.pt', map_location='cpu', weights_only=True))
    model.eval()

    # Create dummy input
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
    print("Model converted to ONNX successfully!")

if __name__ == "__main__":
    convert_to_onnx()