extends Node3D
class_name Switchroom

@onready var lineup: Node3D = $SwitchboardLineup
@onready var trolley: VcbTrolley = $VcbTrolley
@onready var watertight_door: WatertightDoor = $WatertightDoor
@onready var room_shell: Node3D = $RoomShell
@onready var room_arch: Node3D = $RoomArchitecture
@onready var co2_extinguisher: Node3D = $CO2Extinguisher
@onready var rescue_hook: Node3D = $RescueHook
@onready var ppe_locker: PpeLocker = $PpeLocker
@onready var permit_desk: StationBeacon = $PermitDesk
@onready var test_bench: StationBeacon = $TestBench
@onready var key_board: StationBeacon = $KeyBoard
@onready var vcb_workbench: Node3D = $VcbWorkbench
