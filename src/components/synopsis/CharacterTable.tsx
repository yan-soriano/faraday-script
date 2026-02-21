import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Character, RoleType } from '@/types/screenplay';

const roleLabels: Record<RoleType, string> = {
  main: 'Главный',
  secondary: 'Второстепенный',
  adult: 'Взрослый',
};

export default function CharacterTable() {
  const { characters, addCharacter, updateCharacter, removeCharacter } = useProjectStore();

  const handleAdd = () => {
    addCharacter({
      id: crypto.randomUUID(),
      name: '',
      age: 10,
      traits: '',
      roleType: 'main',
    });
  };

  const mainCount = characters.filter((c) => c.roleType === 'main').length;
  const adultCount = characters.filter((c) => c.roleType === 'adult').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Персонажи</h3>
          <span className="text-xs text-muted-foreground">
            Главных: <span className={mainCount === 8 ? 'text-success' : 'text-primary'}>{mainCount}/8</span>
            {' · '}
            Взрослых: <span className={adultCount <= 4 ? 'text-success' : 'text-destructive'}>{adultCount}/4</span>
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleAdd} className="h-7 text-xs gap-1">
          <Plus size={14} /> Добавить
        </Button>
      </div>

      {characters.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
          Нет персонажей. Нажмите «Добавить» чтобы создать.
        </p>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {characters.map((c) => (
          <CharacterRow
            key={c.id}
            character={c}
            onUpdate={(u) => updateCharacter(c.id, u)}
            onRemove={() => removeCharacter(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CharacterRow({
  character: c,
  onUpdate,
  onRemove,
}: {
  character: Character;
  onUpdate: (u: Partial<Character>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_60px_1fr_120px_32px] gap-2 items-center p-2 rounded-md bg-secondary/50 animate-fade-in">
      <Input
        placeholder="Имя"
        value={c.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="h-8 text-xs bg-input"
      />
      <Input
        type="number"
        placeholder="Возраст"
        value={c.age || ''}
        onChange={(e) => onUpdate({ age: parseInt(e.target.value) || 0 })}
        className="h-8 text-xs bg-input"
        min={1}
        max={99}
      />
      <Input
        placeholder="Характер / особенности"
        value={c.traits}
        onChange={(e) => onUpdate({ traits: e.target.value })}
        className="h-8 text-xs bg-input"
      />
      <Select value={c.roleType} onValueChange={(v: RoleType) => onUpdate({ roleType: v })}>
        <SelectTrigger className="h-8 text-xs bg-input">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="main">Главный</SelectItem>
          <SelectItem value="secondary">Второстепенный</SelectItem>
          <SelectItem value="adult">Взрослый</SelectItem>
        </SelectContent>
      </Select>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
