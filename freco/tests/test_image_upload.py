from pathlib import Path

import pytest
from fastapi import HTTPException

from app.main import parse_candidate_embeddings
from app.utils.image_utils import decode_uploaded_image


def test_uploaded_image_decodes_to_bgr_array():
    image_path = Path(__file__).parent.parent / "test_images" / "baseline.jpg"
    image = decode_uploaded_image(image_path.read_bytes())

    assert image.ndim == 3
    assert image.shape[2] == 3


def test_candidate_embeddings_are_normalized_without_identity_data():
    vectors = parse_candidate_embeddings('{"color":[[3' + ",0" * 511 + "]]}")

    assert len(vectors["color"]) == 1
    assert vectors["color"][0].shape == (512,)
    assert vectors["color"][0][0] == pytest.approx(1.0)


@pytest.mark.parametrize("payload", ["{}", "[]", '{"color":[[0, 1]]}', "not-json"])
def test_candidate_embeddings_reject_invalid_vectors(payload):
    with pytest.raises(HTTPException) as error:
        parse_candidate_embeddings(payload)

    assert error.value.status_code == 422
