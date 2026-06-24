
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Palette } from "lucide-react"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

const predefinedColors = [
  { value: "red", label: "Vermelho", hsl: [0, 70, 50] },
  { value: "orange", label: "Laranja", hsl: [20, 70, 50] },
  { value: "amber", label: "Âmbar", hsl: [45, 70, 50] },
  { value: "yellow", label: "Amarelo", hsl: [60, 70, 50] },
  { value: "lime", label: "Lima", hsl: [80, 70, 50] },
  { value: "green", label: "Verde", hsl: [120, 70, 50] },
  { value: "emerald", label: "Esmeralda", hsl: [140, 70, 50] },
  { value: "teal", label: "Teal", hsl: [160, 70, 50] },
  { value: "cyan", label: "Ciano", hsl: [180, 70, 50] },
  { value: "sky", label: "Céu", hsl: [200, 70, 50] },
  { value: "blue", label: "Azul", hsl: [220, 70, 50] },
  { value: "indigo", label: "Índigo", hsl: [240, 70, 50] },
  { value: "violet", label: "Violeta", hsl: [260, 70, 50] },
  { value: "purple", label: "Roxo", hsl: [280, 70, 50] },
  { value: "fuchsia", label: "Fúcsia", hsl: [300, 70, 50] },
  { value: "pink", label: "Rosa", hsl: [320, 70, 50] },
  { value: "rose", label: "Rosa Escuro", hsl: [340, 70, 50] },
  { value: "slate", label: "Ardósia", hsl: [210, 15, 50] },
  { value: "gray", label: "Cinza", hsl: [0, 0, 50] },
  { value: "zinc", label: "Zinco", hsl: [0, 0, 50] },
  { value: "neutral", label: "Neutro", hsl: [0, 0, 50] },
  { value: "stone", label: "Pedra", hsl: [25, 15, 50] }
];

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [customMode, setCustomMode] = React.useState(false)
  
  // Estado para valores HSL customizados
  const [hue, setHue] = React.useState([0])
  const [saturation, setSaturation] = React.useState([70])
  const [lightness, setLightness] = React.useState([50])
  
  const currentPredefined = predefinedColors.find(c => c.value === value)
  
  // Inicializar HSL com base na cor atual
  React.useEffect(() => {
    if (currentPredefined && !customMode) {
      setHue([currentPredefined.hsl[0]])
      setSaturation([currentPredefined.hsl[1]])
      setLightness([currentPredefined.hsl[2]])
    }
  }, [value, currentPredefined, customMode])

  const currentHSL = customMode ? [hue[0], saturation[0], lightness[0]] : 
    (currentPredefined ? currentPredefined.hsl : [0, 70, 50])

  const getColorString = (h: number, s: number, l: number) => 
    `hsl(${h}, ${s}%, ${l}%)`

  const getBadgeColorClass = (h: number, s: number, l: number) => {
    // Ajustar para melhor legibilidade
    const bgLightness = Math.max(Math.min(l, 85), 15); // Limitar entre 15% e 85%
    const bgSaturation = Math.max(Math.min(s, 80), 30); // Limitar saturação
    
    // Texto sempre com bom contraste
    const textLightness = bgLightness > 55 ? 15 : 85;
    const textSaturation = bgSaturation > 50 ? 30 : 20;
    
    // Borda com contraste médio
    const borderLightness = bgLightness > 50 ? bgLightness - 25 : bgLightness + 25;
    
    return {
      backgroundColor: `hsl(${h}, ${bgSaturation}%, ${bgLightness}%)`,
      color: `hsl(${h}, ${textSaturation}%, ${textLightness}%)`,
      borderColor: `hsl(${h}, ${bgSaturation}%, ${borderLightness}%)`
    }
  }

  const handleCustomColorChange = () => {
    // Criar um valor único baseado nos valores HSL
    const customValue = `custom-${hue[0]}-${saturation[0]}-${lightness[0]}`
    onChange(customValue)
  }

  const handlePredefinedSelect = (color: typeof predefinedColors[0]) => {
    setCustomMode(false)
    setHue([color.hsl[0]])
    setSaturation([color.hsl[1]])
    setLightness([color.hsl[2]])
    onChange(color.value)
  }

  const getDisplayLabel = () => {
    if (currentPredefined && !customMode) {
      return currentPredefined.label
    }
    return `Personalizada HSL(${currentHSL[0]}, ${currentHSL[1]}%, ${currentHSL[2]}%)`
  }

  const getHueGradient = () => {
    const colors = []
    for (let i = 0; i <= 360; i += 30) {
      colors.push(`hsl(${i}, 100%, 50%)`)
    }
    return `linear-gradient(to right, ${colors.join(', ')})`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-start gap-2"
        >
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border-2"
              style={{ 
                backgroundColor: getColorString(currentHSL[0], currentHSL[1], currentHSL[2]),
                borderColor: getColorString(currentHSL[0], currentHSL[1], Math.max(currentHSL[2] - 20, 20))
              }}
            />
            <span className="truncate text-sm">{getDisplayLabel()}</span>
          </div>
          <Palette className="h-4 w-4 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 bg-background border shadow-lg z-50">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Escolha uma cor</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={!customMode ? "default" : "outline"}
                onClick={() => setCustomMode(false)}
              >
                Predefinidas
              </Button>
              <Button
                size="sm"
                variant={customMode ? "default" : "outline"}
                onClick={() => setCustomMode(true)}
              >
                Personalizada
              </Button>
            </div>
          </div>
          
          {/* Preview da cor atual */}
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              style={getBadgeColorClass(currentHSL[0], currentHSL[1], currentHSL[2])}
              className="border-2 font-medium"
            >
              {getDisplayLabel()}
            </Badge>
            <div 
              className="w-12 h-12 rounded-md border-2 shadow-inner"
              style={{ 
                backgroundColor: getColorString(currentHSL[0], currentHSL[1], currentHSL[2]),
                borderColor: getColorString(currentHSL[0], currentHSL[1], Math.max(currentHSL[2] - 20, 20))
              }}
            />
          </div>

          {customMode ? (
            <div className="space-y-4">
              {/* Controle de Matiz (Hue) */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Matiz</label>
                  <span className="text-xs text-muted-foreground">{hue[0]}°</span>
                </div>
                <div className="relative">
                  <div 
                    className="h-4 rounded-md mb-2"
                    style={{ background: getHueGradient() }}
                  />
                  <Slider
                    value={hue}
                    onValueChange={(value) => {
                      setHue(value)
                      handleCustomColorChange()
                    }}
                    min={0}
                    max={360}
                    step={1}
                    className="absolute top-0 left-0 right-0"
                  />
                </div>
              </div>

              {/* Controle de Saturação */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Saturação</label>
                  <span className="text-xs text-muted-foreground">{saturation[0]}%</span>
                </div>
                <div className="relative">
                  <div 
                    className="h-4 rounded-md mb-2"
                    style={{ 
                      background: `linear-gradient(to right, 
                        hsl(${hue[0]}, 0%, ${lightness[0]}%), 
                        hsl(${hue[0]}, 100%, ${lightness[0]}%))`
                    }}
                  />
                  <Slider
                    value={saturation}
                    onValueChange={(value) => {
                      setSaturation(value)
                      handleCustomColorChange()
                    }}
                    min={20}
                    max={100}
                    step={1}
                    className="absolute top-0 left-0 right-0"
                  />
                </div>
              </div>

              {/* Controle de Luminosidade */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Luminosidade</label>
                  <span className="text-xs text-muted-foreground">{lightness[0]}%</span>
                </div>
                <div className="relative">
                  <div 
                    className="h-4 rounded-md mb-2"
                    style={{ 
                      background: `linear-gradient(to right, 
                        hsl(${hue[0]}, ${saturation[0]}%, 0%), 
                        hsl(${hue[0]}, ${saturation[0]}%, 50%), 
                        hsl(${hue[0]}, ${saturation[0]}%, 100%))`
                    }}
                  />
                  <Slider
                    value={lightness}
                    onValueChange={(value) => {
                      setLightness(value)
                      handleCustomColorChange()
                    }}
                    min={20}
                    max={80}
                    step={1}
                    className="absolute top-0 left-0 right-0"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Selecione uma cor predefinida:
              </div>
              <div className="grid grid-cols-6 gap-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handlePredefinedSelect(color)}
                    className={`w-10 h-10 rounded-md border-2 transition-all hover:scale-110 ${
                      value === color.value ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                    style={{ 
                      backgroundColor: getColorString(color.hsl[0], color.hsl[1], color.hsl[2]),
                      borderColor: getColorString(color.hsl[0], color.hsl[1], Math.max(color.hsl[2] - 20, 20))
                    }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
