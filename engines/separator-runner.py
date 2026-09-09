"""Run UVR using the Windows trust store; never disable certificate verification."""
import os
import ssl
import tempfile
from pathlib import Path

if __name__ == "__main__":
    context = ssl.create_default_context()
    with tempfile.TemporaryDirectory(prefix="switchyard-certificates-") as folder:
        bundle = Path(folder) / "trusted-roots.pem"
        bundle.write_text("".join(ssl.DER_cert_to_PEM_cert(cert) for cert in context.get_ca_certs(binary_form=True)), encoding="ascii")
        os.environ["REQUESTS_CA_BUNDLE"] = str(bundle)
        from audio_separator.utils.cli import main
        main()
