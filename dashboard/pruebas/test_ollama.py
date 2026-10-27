import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dashboard.servicios import ollama


class TestOllama(unittest.TestCase):
    def test_estado_reconoce_modelo_instalado(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({
            "models": [{"name": "qwen3:1.7b"}]
        }).encode("utf-8")
        with patch.object(ollama, "urlopen", return_value=response):
            resultado = ollama.estado_ollama()
        self.assertTrue(resultado["conectado"])
        self.assertTrue(resultado["modelo_disponible"])

    def test_estado_indica_modelo_ausente(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({
            "models": [{"name": "llama3.2:3b"}]
        }).encode("utf-8")
        with patch.object(ollama, "urlopen", return_value=response):
            resultado = ollama.estado_ollama()
        self.assertTrue(resultado["conectado"])
        self.assertFalse(resultado["modelo_disponible"])

    def test_no_consulta_generacion_si_ollama_no_esta_disponible(self):
        with patch.object(ollama, "estado_ollama", return_value={
            "ok": False, "conectado": False, "error": "Ollama apagado."
        }), patch.object(ollama, "urlopen") as peticion:
            resultado = ollama.consultar_ollama("¿Cómo está la bomba?")
        self.assertFalse(resultado["ok"])
        self.assertFalse(resultado["conectado"])
        peticion.assert_not_called()

    def test_prompt_incluye_contexto_y_limita_afirmaciones(self):
        prompt = ollama._construir_prompt(
            "¿La bomba está averiada?",
            {"registros_recientes": [{"motor_id": "M-01", "caudal": 0.0}]},
        )
        self.assertIn("M-01", prompt)
        self.assertIn("no confirma por sí sola", prompt)
        self.assertIn("¿La bomba está averiada?", prompt)


if __name__ == "__main__":
    unittest.main()
