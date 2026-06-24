import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function checkNullability() {
  const { error } = await supabase
    .from('processos')
    .insert([{ 
        titulo: 'Teste Nullability', 
        office_id: 'any-uuid', // Needs a real one or just check error message
        cliente_id: null 
    }])
  
  console.log('Error:', error?.message)
}

checkNullability()
