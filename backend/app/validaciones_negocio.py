from typing import Literal
from pydantic import Field, field_validator
from .validaciones import Input


class ProductInput(Input):
    sku: str = Field(min_length=3, max_length=40)
    name: str = Field(min_length=3, max_length=100)
    description: str = Field(default='', max_length=600)
    category: str = Field(min_length=3, max_length=60)
    condition: Literal['NUEVO', 'REACONDICIONADO']
    price_cents: int = Field(gt=0, le=100000000, strict=True)
    specifications: dict[str, str] | None = None
    description_edit_reason: str = Field(default='', max_length=250)

    @field_validator('sku')
    @classmethod
    def normalized_sku(cls, value):
        return value.upper()


class StockInput(Input):
    quantity: int = Field(ge=-10000, le=10000, strict=True)
    reason: str = Field(min_length=5, max_length=250)


class OrderItem(Input):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100, strict=True)


class OrderInput(Input):
    client_id: int | None = Field(default=None, gt=0)
    payment_type: Literal['CONTADO', 'CREDITO']
    installments: Literal[1, 3, 6, 12] = 1
    tradein_model: str = Field(default='', max_length=150)
    tradein_discount_cents: int = Field(default=0, ge=0, strict=True)
    items: list[OrderItem] = Field(min_length=1, max_length=30)
    delivery_mode: Literal['RETIRO', 'ENTREGA'] = 'RETIRO'
    delivery_address: str = Field(default='', max_length=250)
    contact_phone: str = Field(default='', max_length=25)


class CheckoutInput(OrderInput):
    request_key: str = Field(min_length=20, max_length=100)
    demo_payment_confirmed: bool = False


class DecisionInput(Input):
    approve: bool
    reason: str = Field(default='', max_length=250)
    installments: Literal[3, 6, 12] | None = None


class PaymentInput(Input):
    amount_cents: int = Field(gt=0, le=100000000, strict=True)
    reference: str = Field(min_length=3, max_length=80)


class AssemblyInput(Input):
    product_id: int = Field(gt=0)
    component_ids: list[int] = Field(min_length=1, max_length=30)
    notes: str = Field(min_length=5, max_length=500)


class UserInput(Input):
    name: str = Field(min_length=3, max_length=100)
    email: str = Field(min_length=5, max_length=120, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=8, max_length=128)
    role: Literal['admin', 'client', 'sales', 'technician', 'inventory', 'finance']
    client_id: int | None = Field(default=None, gt=0)


class UserUpdateInput(Input):
    name: str = Field(min_length=3, max_length=100)
    email: str = Field(min_length=5, max_length=120, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    role: Literal['admin', 'client', 'sales', 'technician', 'inventory', 'finance']
    client_id: int | None = Field(default=None, gt=0)
