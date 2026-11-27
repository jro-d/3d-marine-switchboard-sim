extends Node3D
class_name HvBay

@export var cub_id: String = "DG1"
@export var title_text: String = "C1 · DG1"

@onready var model: Node3D = $Model
@onready var vcb_mount: Node3D = $VcbMount
@onready var vcb_cassette: Node3D = $VcbMount/VcbCassette

var lv_door_pivot: Node3D
var breaker_door_pivot: Node3D
var lv_door_open: bool = false
var breaker_door_open: bool = false
var rack_progress: float = 1.0  # 0.0 = disconnected/test, 1.0 = service/connected


func _ready() -> void:
	if model != null:
		lv_door_pivot = model.find_child("LvDoorPivot", true, false) as Node3D
		breaker_door_pivot = model.find_child("BreakerDoorPivot", true, false) as Node3D


func set_breaker_door_open(is_open: bool) -> void:
	breaker_door_open = is_open
	if breaker_door_pivot != null:
		breaker_door_pivot.rotation.y = deg_to_rad(-105.0) if is_open else 0.0


func set_lv_door_open(is_open: bool) -> void:
	lv_door_open = is_open
	if lv_door_pivot != null:
		lv_door_pivot.rotation.y = deg_to_rad(-105.0) if is_open else 0.0


func set_rack_progress(t: float) -> void:
	rack_progress = clampf(t, 0.0, 1.0)
	if vcb_cassette != null:
		# Service (1.0) -> Z = 0.0; Disconnected/Test (0.0) -> pulled forward +0.26m toward door
		vcb_cassette.position.z = lerpf(0.26, 0.0, rack_progress)
