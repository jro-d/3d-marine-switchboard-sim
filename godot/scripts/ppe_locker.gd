extends Node3D
class_name PpeLocker

@onready var model: Node3D = $Model

var suit_node: Node3D
var gloves_node: Node3D
var boots_node: Node3D


func _ready() -> void:
	if model == null:
		return
	suit_node = model.find_child("PpeLockerSuit", true, false) as Node3D
	gloves_node = model.find_child("PpeLockerGloves", true, false) as Node3D
	boots_node = model.find_child("PpeLockerBoots", true, false) as Node3D


func set_ppe_equipped(suit_taken: bool, gloves_taken: bool, boots_taken: bool) -> void:
	if suit_node != null:
		suit_node.visible = not suit_taken
	if gloves_node != null:
		gloves_node.visible = not gloves_taken
	if boots_node != null:
		boots_node.visible = not boots_taken
