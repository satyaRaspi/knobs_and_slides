from typing import Literal

MappingType = Literal["linear", "inverted", "stepped"]


def map_value(relative_position: float, input_min: float = 0, input_max: float = 360,
              output_min: float = 0, output_max: float = 100, precision: int = 3,
              mapping_type: str = "linear") -> float:
    if input_max == input_min:
        raise ValueError("input_max and input_min cannot be the same")
    if relative_position < input_min or relative_position > input_max:
        raise ValueError(f"relative_position must be between {input_min} and {input_max}")

    ratio = (relative_position - input_min) / (input_max - input_min)

    if mapping_type == "linear":
        value = output_min + ratio * (output_max - output_min)
    elif mapping_type == "inverted":
        value = output_max - ratio * (output_max - output_min)
    elif mapping_type == "stepped":
        steps = 10
        step_index = round(ratio * steps)
        value = output_min + (step_index / steps) * (output_max - output_min)
    else:
        raise ValueError(f"Unsupported mapping_type: {mapping_type}")

    return round(value, precision)
