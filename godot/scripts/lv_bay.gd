extends Node3D
class_name LvBay

@export var cub_id: String = "ACB-TR1-LV"

@onready var model: Node3D = $Model
var upper_door_pivot: Node3D
var lower_door_pivot: Node3D


func _ready() -> void:
	if model != null:
		upper_door_pivot = model.find_child("LvUpperDoorPivot", true, false) as Node3D
		lower_door_pivot = model.find_child("LvLowerDoorPivot", true, false) as Node3D


func set_doors_open(upper_open: bool, lower_open: bool) -> void:
	if upper_door_pivot != null:
		upper_door_pivot.rotation.y = deg_to_rad(-105.0) if upper_open else 0.0
	if lower_door_pivot != null:
		lower_door_pivot.rotation.y = deg_to_rad(-105.0) if lower_open else 0.0
