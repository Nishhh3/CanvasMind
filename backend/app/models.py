from sqlmodel import Field, SQLModel


class ItemBase(SQLModel):
    title: str
    description: str | None = None


class Item(ItemBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class ItemCreate(ItemBase):
    pass
