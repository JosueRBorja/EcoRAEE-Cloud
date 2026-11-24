"""Almacenamiento privado de evidencias con alternativa local."""
import mimetypes
import os
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException, Response
from fastapi.responses import FileResponse


@lru_cache(maxsize=1)
def s3_client():
    import boto3

    return boto3.client('s3')


def save_evidence(directory, filename, content, mime):
    bucket = os.getenv('ECORAEE_EVIDENCE_BUCKET')
    if bucket:
        s3_client().put_object(Bucket=bucket, Key=f'evidence/{filename}',
                               Body=bytes(content), ContentType=mime)
    else:
        (directory / filename).write_bytes(content)


def delete_evidence(directory, filename):
    bucket = os.getenv('ECORAEE_EVIDENCE_BUCKET')
    if bucket:
        s3_client().delete_object(Bucket=bucket, Key=f'evidence/{filename}')
    else:
        (directory / filename).unlink(missing_ok=True)


def evidence_response(directory, filename):
    if Path(filename).name != filename or filename in ('.', '..'):
        raise HTTPException(404, 'Evidencia no encontrada.')
    headers = {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}
    bucket = os.getenv('ECORAEE_EVIDENCE_BUCKET')
    if bucket:
        client = s3_client()
        try:
            item = client.get_object(Bucket=bucket, Key=f'evidence/{filename}')
        except client.exceptions.NoSuchKey as exc:
            raise HTTPException(404, 'Evidencia no encontrada.') from exc
        with item['Body'] as body:
            return Response(body.read(), media_type=mimetypes.guess_type(filename)[0],
                            headers=headers)
    path = directory / filename
    if not path.is_file():
        raise HTTPException(404, 'Evidencia no encontrada.')
    return FileResponse(path, headers=headers)
