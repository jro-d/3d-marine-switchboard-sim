extends Node3D
class_name WatertightDoor

@onready var model: Node3D = $Model

var door_leaf_pivot: Node3D
var handwheel_pivot: Node3D
var is_open: bool = false


func _ready() -> void:
	if model == null:
		return
	door_leaf_pivot = model.find_child("DoorLeafPivot", true, false) as Node3D
	handwheel_pivot = model.find_child("HandwheelPivot", true, false) as Node3D


func set_door_open(open_state: bool) -> void:
	is_open = open_state
	if handwheel_pivot != null:
		handwheel_pivot.rotation.z = deg_to_rad(135.0) if open_state else 0.0
	if door_leaf_pivot != null:
		door_leaf_pivot.rotation.y = deg_to_rad(-95.0) if open_state else 0.0
