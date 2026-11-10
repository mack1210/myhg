# 친구와 함께 이해하는 AI와 환경변수 관리

[그림과 함께 보는 HTML 안내서](../index.html) · 저장소를 내려받아 `index.html`을 브라우저에서 열면 됩니다.

설정을 도시락에 비유하면, **chezmoi는 도시락을 만드는 도구**, **`.chezmoidata.yaml`은 재료 목록**, **템플릿은 조리법**입니다.
API 키 같은 비밀번호는 별도 금고인 `pass`에 넣고, 재료 목록에는 금고의 칸 이름만 적습니다.
이 목록과 양식을 GitHub에 보관하면, 다른 컴퓨터에서도 `chezmoi update` 한 번으로 관리 중인 설정 파일에 일괄 반영할 수 있습니다.

## 1. 무엇을 어디에 둘까?

| 이름 | 쉬운 설명 | 예시 |
| --- | --- | --- |
| 환경변수 | 프로그램이 실행될 때 읽는 이름표 | `APP_NAME=friend-ai` |
| `.chezmoidata.yaml` | 여러 설정에서 함께 쓸 값 | 앱 이름, 금고 칸 이름 |
| `.tmpl` 파일 | 빈칸을 채울 설정 양식 | `{{ .app.name }}` |
| `pass` | 비밀값을 보관하는 금고 | 실제 API 키 |
| Git | 설정의 변경 기록과 컴퓨터 사이의 전달 통로 | 내 dotfiles 저장소 |

`.chezmoidata.yaml`만 만들면 환경변수가 생기는 것은 아니고, chezmoi가 양식의 빈칸을 채워 파일을 만들어 줍니다.
그 파일을 읽거나 환경변수로 전달하는 일은 실행할 프로그램이나 셸이 맡습니다.

## 2. 비밀값 없이 먼저 따라 해 보기

아래 실습은 chezmoi가 설치된 Bash에서 실행하며, 임시 폴더 안에서만 파일을 만듭니다.

```bash
demo_dir=$(mktemp -d)
mkdir -p "$demo_dir/source" "$demo_dir/home"
printf '{}\n' > "$demo_dir/config.json"
cm() {
  chezmoi --config "$demo_dir/config.json" \
    --source "$demo_dir/source" --destination "$demo_dir/home" \
    --cache "$demo_dir/cache" --persistent-state "$demo_dir/state.boltdb" "$@"
}
```

재료 목록을 `$demo_dir/source/.chezmoidata.yaml`에 저장합니다.

```yaml
app:
  name: friend-ai
  environment: practice
```

양식을 `$demo_dir/source/private_dot_friend-ai.env.tmpl`에 저장합니다.

```text
APP_NAME={{ .app.name | quote }}
APP_ENV={{ .app.environment | quote }}
```

`{{ .app.name }}`은 재료 목록의 `app` 안에서 `name`을 꺼내라는 뜻입니다.
`dot_`은 완성 파일 이름의 점(`.`), `.tmpl`은 양식, `private_`는 다른 사용자가 읽지 못하도록 권한을 제한하라는 표시입니다.

```bash
# 먼저 완성될 내용을 확인합니다. 이 실습에는 비밀값이 없습니다.
cm execute-template < "$demo_dir/source/private_dot_friend-ai.env.tmpl"
cm diff
# 확인한 내용을 임시 폴더에 만듭니다.
cm apply
```

완성된 `$demo_dir/home/.friend-ai.env`는 다음과 같습니다.

```dotenv
APP_NAME="friend-ai"
APP_ENV="practice"
```

아래 명령으로 이 실습 파일을 현재 Bash에 읽히면, 그 뒤 실행하는 프로그램도 값을 받습니다.

```bash
set -a
. "$demo_dir/home/.friend-ai.env"
set +a
printf '%s\n' "$APP_NAME"
# friend-ai
```

`source`에 해당하는 `.` 명령은 파일을 코드로 실행하므로 직접 만든 신뢰할 수 있는 파일에만 사용합니다.
이 양식은 단순한 연습값용이며, 프로그램마다 `.env`를 읽는 규칙은 다를 수 있습니다.

## 3. 실제 API 키는 금고에서 꺼내기

`pass` 설치와 GPG 금고 초기화를 마쳤다면 `pass insert api/openai/api_key`로 키를 입력합니다.
키는 채팅이나 명령어 인수에 붙이지 않고, 입력 창에서 입력합니다.

재료 목록에는 실제 키 대신 다음 **경로**를 추가합니다.

```yaml
secrets:
  api:
    openai_api_key: api/openai/api_key
```

템플릿에서 다음 한 줄을 사용하면 chezmoi가 `pass`에서 키를 읽어 채웁니다.

```text
OPENAI_API_KEY={{ pass .secrets.api.openai_api_key | quote }}
```

금고는 비밀을 꺼내기 전까지 보호하며, 완성된 `.env`에는 실제 키가 들어갑니다.
완성 파일은 Git에 넣지 않고, 비밀을 출력할 수 있는 `diff`·`execute-template` 결과도 채팅이나 공유 화면에 올리지 않습니다.
`quote`는 값을 큰따옴표로 감싸지만 암호화하지 않으며, 특수문자가 있는 비밀값은 사용할 프로그램의 파일 규칙을 확인해야 합니다.

## 4. 내 설정에 연결할 때

실제 재료 목록은 `chezmoi source-path`가 알려주는 폴더의 `.chezmoidata.yaml`에 둡니다.
기존 파일이 있으면 필요한 항목을 합치고, 같은 이름의 항목을 중복해서 만들지 않습니다.
`cgmoi` 방식에서는 일반 설정은 데이터에, 비밀은 `pass`에 두고, 이미 암호화된 `.env` 양식은 암호화 상태를 유지합니다.
`chezmoi apply`는 실제 파일을 바꾸므로 대상 파일과 변경 내용을 먼저 확인하며, 자동 커밋·푸시 설정도 확인합니다.

## 5. AI에게 이렇게 부탁하기

AI에게는 재료 목록의 구조, 가짜 값, 원하는 결과를 알려주면 됩니다.

```text
chezmoi로 AI 앱 설정을 관리하고 싶어.
앱 이름은 .chezmoidata.yaml의 app.name에서 읽어 줘.
API 키는 pass의 api/openai/api_key에서 읽도록 해 줘.
실제 비밀값을 읽거나 출력하지 말고, 가짜 pass로 템플릿을 검사해 줘.
기존 암호화 방식은 유지하고, 실제 파일 적용 전에는 변경안을 보여 줘.
```

친구에게는 **“AI는 양식을 만들고, chezmoi는 값을 채우고, pass는 비밀을 보관한다”**고 설명하면 됩니다.

## 6. Git과 연결하면 여러 컴퓨터에 한 번에 반영해요

GitHub에 내 조리법 책을 보관한다고 생각하면 됩니다.
컴퓨터 A에서 목록과 양식을 바꿔 올리고, 컴퓨터 B에서는 `chezmoi update` 한 번으로 내려받아 관리 중인 파일들에 일괄 적용합니다.
예를 들어 같은 `app.name`을 읽는 설정 파일이 세 개라면, 데이터 한 곳만 바꿔도 세 파일을 함께 새로 만들 수 있습니다.

### 처음 연결하는 컴퓨터

Git이 설치돼 있고 내 dotfiles 저장소에 데이터와 양식이 올라가 있다면, `YOUR_NAME`을 내 계정으로 바꿔 실행합니다.
아래 명령은 저장소를 받아 실제 홈 설정에 적용하므로, 처음에는 믿을 수 있는 내 저장소로 시작합니다.

```bash
# 처음 한 번: 내 설정 저장소를 내려받고 적용합니다.
chezmoi init --apply https://github.com/YOUR_NAME/dotfiles.git
```

이 문서 저장소 `myhg`는 설명서이고, 설정을 동기화할 저장소는 별도의 `dotfiles`입니다.
작성자의 설정 저장소는 `mack1210/dotfiles`이며, 친구들은 각자 자신의 저장소를 사용하면 됩니다.

### 컴퓨터 A에서 바꾸고 올리기

`chezmoi source-path`가 알려주는 폴더에서 `.chezmoidata.yaml`과 양식을 수정한 뒤 실행합니다.
아래는 앞서 만든 비밀 없는 예제 파일을 사용하며, Git 작성자 정보와 원격 저장소 인증이 준비돼 있어야 합니다.

```bash
# 관리 중인 양식들에 값을 채워, 이 컴퓨터에 일괄 적용합니다.
chezmoi apply
# 데이터와 양식을 기록하고 GitHub로 올립니다.
chezmoi git add .chezmoidata.yaml private_dot_friend-ai.env.tmpl
chezmoi git -- commit -m "Update AI app settings"
chezmoi git push
```

일반 설정 파일을 홈에서 직접 바꿨다면 `chezmoi re-add <파일>`로 먼저 소스에 반영합니다.
템플릿으로 관리하는 값은 데이터·양식을 고치고, 비밀이 있는 파일은 기존 암호화 방식을 유지합니다.

### 컴퓨터 B에서 한 번에 받기

```bash
# GitHub에서 최신 설정을 받고, 관리 파일들에 일괄 적용합니다.
chezmoi update
```

`apply`는 현재 소스로 파일을 만들고, `git push`는 소스를 올리고, `update`는 소스를 내려받은 뒤 파일까지 만듭니다.
같은 양식도 컴퓨터별 데이터에 따라 다른 결과를 낼 수 있으며, 실행 중인 앱은 설정을 다시 읽거나 재시작해야 할 수 있습니다.

### 올리는 과정도 자동으로 줄이기

각 컴퓨터에서 아래 명령으로 chezmoi 자체 설정을 엽니다.

```bash
chezmoi edit-config
```

TOML 설정을 쓴다면 `~/.config/chezmoi/chezmoi.toml`의 기존 `[git]` 항목에 아래 값을 합칩니다.
이 옵션은 `.chezmoidata.yaml`에 넣는 데이터가 아니며, 기본값은 꺼져 있습니다.

```toml
[git]
    autoCommit = true
    autoPush = true
```

이제 `chezmoi add`·`re-add`·`edit` 같은 명령으로 소스를 변경하면 커밋·푸시를 자동으로 처리할 수 있습니다.
파일을 직접 편집하는 모든 순간을 감시하는 기능은 아니므로, 편집기로 소스만 바꿨다면 Git 기록·푸시 여부를 확인합니다.
다른 컴퓨터에서는 여전히 `chezmoi update`를 실행하며, 주기적인 자동 반영은 별도 예약 실행을 설정해야 합니다.

자동 푸시를 켜면 잘못 담은 비밀값도 바로 올라갈 수 있으므로 데이터·양식에 실제 키가 없는지 먼저 확인합니다.
`pass`의 비밀 저장소와 GPG 키는 이 Git 연결만으로 복제되지 않으므로 각 컴퓨터에서 따로 준비합니다.
업데이트 충돌이나 푸시 오류가 나면 변경 내용을 확인하고 해결하며 강제 푸시로 덮어쓰지 않습니다.

## 예제 검사와 참고 자료

`python3 -m unittest discover -s tests -v`로 문서 속 양식의 값 치환, 환경변수 전달, 가짜 금고 연결을 검사합니다.
테스트에는 Python 3, chezmoi, Git이 필요하며 실제 홈 설정이나 금고를 사용하지 않습니다.
임시 Git 저장소와 가상 컴퓨터 두 개로 최초 적용, 일괄 업데이트, 자동 커밋·푸시도 검사합니다.

- [공식 템플릿 안내](https://www.chezmoi.io/user-guide/templating/)
- [공유 데이터 파일 안내](https://www.chezmoi.io/reference/special-files/chezmoidata-format/)
- [공식 pass 연결 안내](https://www.chezmoi.io/user-guide/password-managers/pass/)
- [execute-template 명령](https://www.chezmoi.io/reference/commands/execute-template/)
- [Git 연동과 자동 커밋·푸시](https://www.chezmoi.io/user-guide/daily-operations/)
- [update 명령](https://www.chezmoi.io/reference/commands/update/)
