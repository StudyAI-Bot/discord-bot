const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

// Konfiguracja OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Konfiguracja Discord bota
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Pamięć odpowiedzi
const userMemory = new Map();

client.once('ready', () => {
  console.log(`🤖 ${client.user.tag} jest online!`);
  console.log('💎 AI Teacher Bot gotowy do działania!');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Sprawdź czy wiadomość jest z kanału premium
  if (message.channel.name.startsWith('💬-') || message.channel.name.startsWith('❓-quiz-')) {
    try {
      const response = await generateAIResponse(message.content, message.author.username);
      
      // Podziel długie wiadomości
      if (response.length > 2000) {
        for (let i = 0; i < response.length; i += 2000) {
          await message.channel.send(response.slice(i, i + 2000));
        }
      } else {
        await message.channel.send(response);
      }
    } catch (error) {
      console.error('Błąd:', error);
      await message.channel.send('❌ Wystąpił błąd podczas przetwarzania twojej wiadomości.');
    }
  }
});

// Funkcja generująca odpowiedź AI
async function generateAIResponse(userMessage, username) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Jesteś pomocnym asystentem nauczyciela. Odpowiadaj w języku polskim. 
          Używaj czytelnych wyjaśnień i przykładów. Bądź przyjazny i zachęcający do nauki.`
        },
        {
          role: "user",
          content: `Użytkownik: ${username}
          Pytanie: ${userMessage}
          
          Odpowiedz jako nauczyciel:`
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Błąd OpenAI:', error);
    return '❌ Przepraszam, wystąpił błąd podczas generowania odpowiedzi.';
  }
}

// Obsługa kanałów głosowych
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member.user.bot) return;

  // Jeśli użytkownik dołączył do kanału "ai-teacher-voice"
  if (newState.channel && newState.channel.name === 'ai-teacher-voice') {
    try {
      const guild = newState.guild;
      const member = newState.member;
      
      // Znajdź lub stwórz kategorię PREMIUM
      let category = guild.channels.cache.find(
        channel => channel.name === '💎 PREMIUM' && channel.type === 4
      );
      
      if (!category) {
        category = await guild.channels.create({
          name: '💎 PREMIUM',
          type: 4, // Kategoria
        });
      }

      // Stwórz kanał tekstowy dla użytkownika
      const textChannel = await guild.channels.create({
        name: `💬-${member.displayName}`,
        type: 0, // Text channel
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['ViewChannel'],
          },
          {
            id: member.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
          {
            id: client.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
        ],
      });

      // Wyrzuć użytkownika z kanału głosowego
      await newState.setChannel(null);

      // Wyślij wiadomość powitalną
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎓 WITAJ W AI TEACHER!')
        .setDescription(`Cześć ${member}! Jestem twoim asystentem nauczyciela.`)
        .addFields(
          { name: '📚 Co potrafię?', value: '• Pomoc w matematyce\n• Wyjaśnienia z fizyki\n• Rozwiązywanie zadań\n• Odpowiedzi na pytania' },
          { name: '💡 Jak używać?', value: 'Po prostu zadaj mi pytanie!' }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await textChannel.send({ embeds: [welcomeEmbed] });
      
    } catch (error) {
      console.error('Błąd tworzenia kanału:', error);
    }
  }
});

// Uruchom bota
client.login(process.env.DISCORD_TOKEN);
