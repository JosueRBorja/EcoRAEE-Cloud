"""Contratos de entrada. La API valida aunque el formulario también lo haga."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')


class ClientInput(Input):
    name: str = Field(min_length=3, max_length=100)
    document: str = Field(min_length=3, max_length=30)
    phone: str = Field(default='', max_length=25)
    address: str = Field(default='', max_length=200)


class DeviceInput(Input):
    model: str = Field(min_length=3, max_length=100)
    category: str = Field(min_length=3, max_length=60)
    client_id: int = Field(gt=0)
    notes: str = Field(default='', max_length=1000)


class ComponentInput(Input):
    name: str = Field(min_length=2, max_length=80)
    classification: Literal['REUTILIZABLE', 'REPARABLE', 'RECICLABLE', 'NO_RECUPERABLE']
    voltage: float | None = Field(default=None, ge=0, le=1000)
    observations: str = Field(default='', max_length=500)


class EvaluationInput(Input):
    technician: str = Field(min_length=3, max_length=100)
    notes: str = Field(min_length=5, max_length=1000)
    components: list[ComponentInput] = Field(min_length=1, max_length=30)


class CloseInput(Input):
    destination: str = Field(min_length=3, max_length=150)
    responsible: str = Field(min_length=3, max_length=100)
    destination_type: Literal['REUTILIZACION', 'REPARACION', 'RECICLAJE', 'DISPOSICION', 'BENEFICIARIO', 'FABRICACION'] = 'RECICLAJE'
