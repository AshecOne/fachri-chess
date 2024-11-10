type GameSituation = 'normal' | 'advantage' | 'disadvantage' | 'check' | 'winning' | 'losing' | 'draw';

export class ChatService {
  private lastResponse: string = '';
  private lastMessageTime: number = 0;
  private messageDelay: number = 500;

  private defaultResponses = [
    "Hmm... menarik juga pemikiran lo",
    "Bener juga sih... kayak yang Camus bilang",
    "Wah, dalem juga ya diskusi kita",
    "Asik nih ngobrolnya, sambil main catur",
    "Kayak filosofi hidup ya, kadang kita harus mikir dalam-dalam",
    "Lo tau ga, ini ngingetin gue sama teori eksistensialisme",
    "Menarik banget cara pandang lo",
    "Iya bener, hidup emang kadang absurd ya",
    "Eh, sambil main catur gini jadi inget Nietzsche",
    "Lo pernah baca karya-karya filosofi ga?",
    "Kadang hidup itu kayak permainan catur ya"
  ];

  private basicResponses = new Map<string, string[]>([
    ['halo', [
      'Halo juga! Gimana kabarnya?',
      'Eh, lo dateng juga nih. Lagi baca Myth of Sisyphus sambil main catur',
      'Hai bro! Siap-siap kalah ya... becanda kok, yang penting prosesnya'
    ]],
    ['kabar', [
      'Baik nih, lagi mikirin filosofi catur sama kehidupan',
      'Yah lu tau lah, absurd tapi tetep harus dijalanin...',
      'Lumayan sih, lagi asik baca buku sambil main catur'
    ]],
    ['nama', [
      'Gue Daffa, anak Bekasi yang suka filosofi',
      'Panggil aja Daffa, penggemar berat Albert Camus nih',
      'Daffa, dan gue percaya hidup itu absurd tapi menarik'
    ]],
    ['camus', [
      'Nah! Lo tau Albert Camus? Keren kan filosofinya',
      'Gue lagi baca Myth of Sisyphus nih, mind-blowing banget',
      'Menurut Camus, hidup emang absurd tapi kita harus embrace it'
    ]],
    ['menang', [
      'Menang kalah ga penting sih, yang penting prosesnya',
      'Kayak Sisyphus ya, perjuangannya yang bikin hidup bermakna',
      'Lo tau ga, kemenangan itu cuma konstruksi sosial...'
    ]],
    ['kalah', [
      'Kalah menang itu kayak hidup, ga ada yang absolut',
      'Yang penting kan prosesnya, kayak Sisyphus gitu',
      'Santai aja, hidup emang kadang ga sesuai ekspektasi'
    ]]
  ]);

  private situationResponses = new Map<GameSituation, string[]>([
    ['advantage', [
      'Hehe, lo dalam bahaya nih kayaknya',
      'Posisi gue enak nih, tapi ya gitu... hidup emang ga ada yang pasti',
      'Menarik juga nih situasinya...'
    ]],
    ['disadvantage', [
      'Hmm... kayak Sisyphus ya gue, harus berjuang',
      'Challenging sih, tapi itulah hidup',
      'Menarik... hidup emang penuh ujian'
    ]],
    ['check', [
      'Skak! Tapi ya dalam hidup yang absurd, apapun bisa terjadi',
      'Check! Hidup emang penuh kejutan ya',
      'Hati-hati raja lo tuh... kayak hidup, selalu ada ancaman'
    ]],
    ['winning', [
      'GG! Tapi menang kalah ga penting sih sebenernya',
      'Nice game! Yang penting prosesnya kan',
      'Mantap! Tapi hidup lebih dari sekedar menang kalah'
    ]],
    ['losing', [
      'Ah... hidup emang kadang ga sesuai ekspektasi ya',
      'Well played! Kayak Sisyphus, besok kita mulai lagi',
      'Good game! Yang penting udah berusaha maksimal'
    ]],
    ['draw', [
      'Draw... kayak hidup ya, ga ada yang absolut',
      'Seri nih, menarik juga kayak paradoks kehidupan',
      'Balance... kayak filosofi hidup yang sempurna'
    ]]
  ]);

  private generateDefaultResponse(): string {
    // Pastikan tidak mengulang respons terakhir
    let response: string;
    do {
      response = this.defaultResponses[Math.floor(Math.random() * this.defaultResponses.length)];
    } while (response === this.lastResponse);
    return response;
  }

  public async generateResponse(
    message: string | null,
    situation: GameSituation = 'normal'
  ): Promise<string | null> {
    const currentTime = Date.now();
    if (currentTime - this.lastMessageTime < this.messageDelay) {
      return null;
    }

    let response: string | null = null;

    // Handle player messages
    if (message) {
      message = message.toLowerCase();
      
      // Cek kata kunci dalam pesan
      for (const [keyword, responses] of this.basicResponses) {
        if (message.includes(keyword)) {
          response = responses[Math.floor(Math.random() * responses.length)];
          break;
        }
      }

      // Jika tidak ada kata kunci yang cocok, gunakan respons default
      if (!response) {
        response = this.generateDefaultResponse();
      }
    }
    // Handle game situations
    else if (situation !== 'normal') {
      const situationResps = this.situationResponses.get(situation);
      if (situationResps) {
        response = situationResps[Math.floor(Math.random() * situationResps.length)];
      }
    }

    if (response) {
      this.lastResponse = response;
      this.lastMessageTime = currentTime;
      return response;
    }

    return this.generateDefaultResponse();
  }
}