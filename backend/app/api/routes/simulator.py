from functools import lru_cache

from fastapi import APIRouter, HTTPException, status

from app.schemas.simulator import MachineSnapshot
from app.simulator.mock import MockMachineSimulator
from app.simulator.source import MachineDataSource

router = APIRouter(prefix="/simulator", tags=["machine-simulator"])


@lru_cache
def get_machine_data_source() -> MachineDataSource:
    return MockMachineSimulator()


@router.get("/machines", response_model=list[MachineSnapshot])
async def list_simulated_machines() -> list[MachineSnapshot]:
    return list(get_machine_data_source().get_machines())


@router.get("/machines/{machine_id}", response_model=MachineSnapshot)
async def get_simulated_machine(machine_id: str) -> MachineSnapshot:
    machine = get_machine_data_source().get_machine(machine_id)
    if machine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine '{machine_id}' was not found",
        )
    return machine
