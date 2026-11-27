extends Node3D
class_name HandheldTool

@export var tool_id: String = ""
var tip_anchor: Node3D


func _ready() -> void:
	tip_anchor = find_child("TipAnchor", true, false) as Node3D


func get_tip_world_position() -> Vector3:
	if tip_anchor != null:
		return tip_anchor.global_position
	return global_position
