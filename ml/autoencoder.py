import torch
import torch.nn as nn
import numpy as np


class Autoencoder(nn.Module):
    def __init__(self, input_dim, bottleneck_dim=8):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, max(bottleneck_dim * 2, input_dim // 2)),
            nn.ReLU(),
            nn.Linear(max(bottleneck_dim * 2, input_dim // 2), bottleneck_dim),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(bottleneck_dim, max(bottleneck_dim * 2, input_dim // 2)),
            nn.ReLU(),
            nn.Linear(max(bottleneck_dim * 2, input_dim // 2), input_dim),
        )

    def forward(self, x):
        z = self.encoder(x)
        return self.decoder(z)


def entrenar_autoencoder(X, epochs=50, batch_size=64, lr=1e-3, device=None):
    if device is None:
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    X_tensor = torch.tensor(X, dtype=torch.float32)
    dataset = torch.utils.data.TensorDataset(X_tensor, X_tensor)
    loader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)

    input_dim = X.shape[1]
    bottleneck_dim = max(4, input_dim // 3)
    modelo = Autoencoder(input_dim, bottleneck_dim).to(device)
    criterio = nn.MSELoss()
    optimizador = torch.optim.Adam(modelo.parameters(), lr=lr)

    modelo.train()
    for epoch in range(epochs):
        perdida_total = 0.0
        for x_batch, _ in loader:
            x_batch = x_batch.to(device)
            reconstruido = modelo(x_batch)
            loss = criterio(reconstruido, x_batch)
            optimizador.zero_grad()
            loss.backward()
            optimizador.step()
            perdida_total += loss.item() * x_batch.size(0)
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f'Epoch {epoch+1}/{epochs} - Loss: {perdida_total / len(X_tensor):.6f}')
    return modelo, device


def calcular_error_reconstruccion(modelo, X, device=None):
    if device is None:
        device = next(modelo.parameters()).device
    modelo.eval()
    X_tensor = torch.tensor(X, dtype=torch.float32).to(device)
    with torch.no_grad():
        reconstruido = modelo(X_tensor).cpu().numpy()
    errores = np.mean((X - reconstruido) ** 2, axis=1)
    return errores, reconstruido
