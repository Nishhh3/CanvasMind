# Example CRUD router -- copy this pattern for each new resource.
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Item, ItemCreate

router = APIRouter()


@router.get("", response_model=list[Item])
def list_items(session: Session = Depends(get_session)):
    return session.exec(select(Item)).all()


@router.post("", response_model=Item)
def create_item(data: ItemCreate, session: Session = Depends(get_session)):
    item = Item.model_validate(data)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    session.delete(item)
    session.commit()
    return {"ok": True}
