import { useState } from 'react';
import UserFormDialog from '../UserFormDialog';
import { Button } from '@/components/ui/button';

export default function UserFormDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <UserFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(data) => console.log('User data:', data)}
      />
    </div>
  );
}
