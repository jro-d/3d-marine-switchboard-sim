extends Node3D
class_name StationBeacon

@export var socket_name: String = ""
@export var bulb_radius: float = 0.024
@export var default_color: Color = Color(0.14, 0.82, 0.36)

var socket_node: Node3D
var bulb_mesh: MeshInstance3D
var bulb_mat: StandardMaterial3D


func _ready() -> void:
	if socket_name != "":
		socket_node = find_child(socket_name, true, false) as Node3D
	if socket_node != null:
		bulb_mesh = MeshInstance3D.new()
		var sphere := SphereMesh.new()
		sphere.radius = bulb_radius
		sphere.height = bulb_radius * 2.0
		bulb_mesh.mesh = sphere
		bulb_mat = StandardMaterial3D.new()
		bulb_mat.albedo_color = default_color
		bulb_mat.emission_enabled = true
		bulb_mat.emission = default_color
		bulb_mat.emission_energy_multiplier = 1.6
		bulb_mesh.material_override = bulb_mat
		socket_node.add_child(bulb_mesh)


func set_indicator_state(color: Color, emission_energy: float = 1.6) -> void:
	if bulb_mat != null:
		bulb_mat.albedo_color = color
		bulb_mat.emission = color
		bulb_mat.emission_energy_multiplier = emission_energy
